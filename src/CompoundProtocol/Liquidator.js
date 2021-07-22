import cTokens from "./cTokens.js";
import GasCosts from "./GasCosts.js";
//import web3 from "../App.js";
import BigNumber from "bignumber.js";
import Web3 from "web3";

const web3 = new Web3("http://192.168.1.2:8545");

async function lookForLiquidations(accountList, app) {
    app.refreshGasPrices();
    const gasFees = (app.state.gasPrices[3] * GasCosts.liquidateBorrow) / 1e9;
    console.log("GAS FEES: " + gasFees);

    let i = 0;
    let stopFlag = 1;
    for (const account of accountList) {
        console.log("ACCOUNT NO " + i);

        if (account.health < 1) stopFlag = await liquidateAccount(app, account);
        if (stopFlag === -1) break;

        i++;
    }
}
export default lookForLiquidations;

/**
 * Takes cToken and amount as input. Returns that amount adjusted to the number of decimals specified by the underlying token.
 * 
 * @param cTokenAddress 
 * @param amount 
 * @returns                amount adjusted to the number of decimals specified by the underlying token
 */
function adjustUnderlyingDecimals(cTokenAddress, amount) {
    const underlyingDecimals = cTokens.find(cToken => cToken.address === cTokenAddress).underlyingDecimals;
    const amountDecimals = new BigNumber(amount).multipliedBy(BigNumber(10).exponentiatedBy(underlyingDecimals)).toFixed();

    console.log("Adjusted decimals: " + amountDecimals);

    return amountDecimals;
}

/**
 * Takes cToken and amount as input. Returns that amount unadjusted to the number of decimals specified by the underlying token.
 * 
 * @param cTokenAddress 
 * @param amountDecimals 
 * @returns                amount unadjusted to the number of decimals specified by the underlying token
 */
function unadjustUnderlyingDecimals(cTokenAddress, amountDecimals) {
    const underlyingDecimals = cTokens.find(cToken => cToken.address === cTokenAddress).underlyingDecimals;
    const amount = new BigNumber(amountDecimals).dividedBy(BigNumber(10).exponentiatedBy(underlyingDecimals)).toFixed();

    console.log("Unadjusted decimals: " + amount);

    return amount;
}

/**
 * Takes borrow and supply as input and returns the max liquidable amount taking into account the close factor and the incentive.
 * 
 * @param supplyInEth 
 * @param borrowInEth 
 * @param closeFactor 
 * @param incentive 
 * @returns             max liquidable amount
 */
function adjustRepayAmountToSupply(supplyInEth, borrowInEth, closeFactor, incentive) {
    let maxLiquidableAmountInEth = borrowInEth * closeFactor;

    if (maxLiquidableAmountInEth * incentive > supplyInEth) maxLiquidableAmountInEth = supplyInEth / incentive;
    return maxLiquidableAmountInEth;
}

/**
 * Takes a token address and amount (no adjusted decimals) as input. 
 * Returns the maximum amount (adjusted decimals) that fits into the balance of the provided token.
 * 
 * @param borrowedAssetAddress  address of the token from which we are getting the balance
 * @param repayAmount           amount (no adjusted decimals) we want to adjust
 * @returns                     max amount (adjusted decimals) that fits into the balance
 */
function adjustRepayAmountToBalance(borrowedAssetAddress, repayAmount, balances) {
    const balance = balances.get(borrowedAssetAddress);
    let repayAmountAdjustedDecimals = adjustUnderlyingDecimals(borrowedAssetAddress, repayAmount);

    if (repayAmountAdjustedDecimals > 0.9 * balance) repayAmountAdjustedDecimals = 0.9 * balance;

    return repayAmountAdjustedDecimals;
}

/**
 * Takes amount in ETH and address as input. Returns same amount converted into the corresponding token's value.
 * 
 * @param amountInEth 
 * @param tokenAddress 
 * @param cTokenList 
 * @returns 
 */
function convertEthToToken(amountInEth, tokenAddress, cTokenList) {
    const token = cTokenList.find(cToken => cToken.address === tokenAddress);

    const amount = BigNumber(amountInEth).dividedBy(BigNumber(token.underlyingPriceInEth));
    return amount;
}

/**
 * Takes an account that we want to liquidate as input. Retrieves the data needed for the liquidation such as addresses and amounts,
 * taking into account the close factor and the incentive. Returns this data as a json.
 * 
 * @param account       address of the account we want to liquidate 
 * @param closeFactor
 * @param incentive
 * @returns             json with the liquidation details
 */
function getLiquidationDetails(account, balances, closeFactor, incentive, cTokenList) {
    const borrowerAddress = account.address;
    const borrowedAssetAddress = account.maxBorrowAddress;
    const collateralAddress = account.maxSupplyAddress;

    const repayAmountInEthAdjustedToSupply = adjustRepayAmountToSupply(account.maxSupplyInEth, account.maxBorrowInEth, account.maxBorrowAddress, closeFactor, incentive);
    const repayAmountAdjustedToSupply = convertEthToToken(repayAmountInEthAdjustedToSupply, borrowedAssetAddress, cTokenList);
    const repayAmountAdjustedToBalance = adjustRepayAmountToBalance(account.maxBorrowAddress, repayAmountAdjustedToSupply, balances);

    return {
        borrowerAddress: borrowerAddress,
        borrowedAssetAddress: borrowedAssetAddress,
        repayAmountInEthAdjustedToSupply: repayAmountInEthAdjustedToSupply,
        repayAmountAdjustedToBalance: repayAmountAdjustedToBalance,
        collateralAddress: collateralAddress
    }
}

/**
 * Returns expected profit in ETH for a specific repay amount of any token.
 * (gas fees are calculated supposing the liquidation costs 400k gas, this may vary).
 * 
 * @param repayAmount 
 * @param gasFees 
 * @param incentive 
 * @param cTokenList            list of all cTokens with the corresponding underlying prices in ETH
 * @param repayTokenAddress     address of the token we are repaying, from which we can retrieve the price in ETH of the underlying token.
 * @returns                     profit in ETH
 */
function getProfitInEth(repayTokenAddress, repayAmountInEthAdjustedToSupply, repayAmountAdjustedToBalance, cTokenList, incentive, gasFeesInEth) {
    const cToken = cTokenList.find(cToken => cToken.address === repayTokenAddress);
    const underlyingPriceInEth = new BigNumber(cToken.underlyingPriceInEth);

    const potentialProfit =
        BigNumber(repayAmountInEthAdjustedToSupply).multipliedBy(BigNumber(underlyingPriceInEth)).multipliedBy(BigNumber(incentive - 1)).minus(BigNumber(gasFeesInEth)).toFixed();
    const achievableProfit =
        BigNumber(repayAmountAdjustedToBalance).multipliedBy(BigNumber(underlyingPriceInEth)).multipliedBy(BigNumber(incentive - 1)).minus(BigNumber(gasFeesInEth)).toFixed();

    console.log("POTENTIAL PROFIT: " + potentialProfit);
    console.log("ACHIEVABLE PROFIT: " + achievableProfit);

    return {
        potentialProfit: potentialProfit,
        achievableProfit: achievableProfit
    };
}


/**
 * Takes an account address as input. Gets all the necessary information from the account in order to liquidate.
 * Computes transaction fees.
 * Checks balance and allowance, if all in order, proceeds with the liquidation.
 * 
 * @param app       app with the close factor and the incentive in its state
 * @param account   address of the account we want to liquidate
 */
async function liquidateAccount(app, account) {
    const gasFeesInEth = BigNumber(app.state.gasPrices[3]).multipliedBy(BigNumber(GasCosts.liquidateBorrow)).dividedBy(BigNumber(10).exponentiatedBy(9)).toFixed();
    const gasFeesInWei = BigNumber(gasFeesInEth).multipliedBy(BigNumber(10).exponentiatedBy(18));

    const { borrowerAddress,
        borrowedAssetAddress,
        repayAmountInEthAdjustedToSupply,
        repayAmountAdjustedToBalance,
        collateralAddress } = getLiquidationDetails(account, app.balances, app.state.closeFactor, app.state.incentive, app.cTokens);


    const { potentialProfit, achievableProfit } =
        getProfitInEth(borrowedAssetAddress, repayAmountInEthAdjustedToSupply,
            unadjustUnderlyingDecimals(borrowedAssetAddress, repayAmountAdjustedToBalance), app.cTokens, app.state.incentive, gasFeesInEth);

    if (achievableProfit <= 0) {
        console.log("Not profitable");

        //If potential profit is <= 0, no account after this one will be profitable -> set the stop flag
        if (potentialProfit <= 0) return -1;

        return 1;
    }

    const allowance = app.allowances.get(borrowedAssetAddress);
    console.log("ALLOWANCE TESTING: " + allowance);

    if (app.isBlocked) {
        return 1;
    } else if (allowance < repayAmountAdjustedToBalance) {
        console.log("Insufficient allowance");

        return 1;
    } else {
        console.log("                        ");
        console.log("________________________");
        console.log("________________________");
        console.log("Executing liquidation...");
        console.log("________________________");
        console.log("________________________");
        console.log("                        ");

        app.isBlocked = true;
        await executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmountAdjustedToBalance, collateralAddress, gasFeesInWei);

        return 1;
    }
}

function getcTokenContract(cTokenAddress) {
    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const cTokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

    return cTokenContract;
}

async function executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmountAdjusted, collateralAddress, gasPrice, app) {
    const contract = new getcTokenContract(borrowedAssetAddress);

    try {
        await web3.eth.personal.unlockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", $account_password)
            .then(console.log("Account unlocked!"));

        //Check if the borrowed asset is cETH
        if (borrowedAssetAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {

            await contract.methods.liquidateBorrow(borrowerAddress, collateralAddress).send({
                from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036",
                value: repayAmountAdjusted,
                gas: 1000000,
                gasPrice: gasPrice
            }).on("transactionHash", function (hash) {
                console.log("Operation's hash: " + hash);
            }).on("confirmation", function (confNumber, receipt, latestBlockHash) {
                console.log("Operation has been confirmed. Number: " + confNumber);
                console.log("Latest block: " + latestBlockHash);
                console.log("Receipt: " + receipt);
            }).on("error", function (error) {
                console.error(error);
            }).then(function (receipt) {
                console.log("The receipt: ");
                console.log(receipt);
                console.log("Has been mined");
            })
        } else {

            await contract.methods.liquidateBorrow(borrowerAddress, repayAmountAdjusted, collateralAddress).send({
                from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036",
                gas: 1000000,
                gasPrice: gasPrice
            }).on("transactionHash", function (hash) {
                console.log("Operation's hash: " + hash);
            }).on("confirmation", function (confNumber, receipt, latestBlockHash) {
                console.log("Operation has been confirmed. Number: " + confNumber);
                console.log("Latest block: " + latestBlockHash);
                console.log("Receipt: " + receipt);
            }).on("error", function (error) {
                console.error(error);
            }).then(function (receipt) {
                console.log("The receipt: ");
                console.log(receipt);
                console.log("Has been mined");
            });
        }

    } catch (error) {

        console.error(error);

    } finally {

        app.isBlocked = false;
        await web3.eth.personal.lockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036")
            .then(console.log("Account locked!"));

    }
}