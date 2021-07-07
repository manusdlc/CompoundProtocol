import cTokens from "/home/robotito/Crypto/compound_liquidator/src/CompoundProtocol/cTokens.js";
import ERC20 from "/home/robotito/Crypto/compound_liquidator/src/CompoundProtocol/ERC20.js";
import GasCosts from "/home/robotito/Crypto/compound_liquidator/src/CompoundProtocol/GasCosts.js";
//import web3 from "../App.js";
import BigNumber from "bignumber.js";

import Web3 from "web3";
export const web3 = new Web3("http://192.168.1.2:8545");

async function lookForLiquidations(accountList, app) {
    app.refreshGasPrices();
    const gasFees = (app.state.gasPrices[3] * GasCosts.liquidateBorrow) / 1e9;
    console.log("GAS FEES: " + gasFees);

    let i = 0;
    for (const account of accountList) {
        if (account.maxProfitInEth > 0 && account.health < 1) await liquidateAccount(app, account);

        console.log("ACCOUNT NO " + i);
        i++;
    }
}
export default lookForLiquidations;

/**
 * Takes account and token address as input. Returns the allowance of the underlying token in that account.
 * Checks if the token is cETH, since ETH is not an ERC-20 token and it has no allowance.
 * @param accountAddress 
 * @param cTokenAddress 
 * @returns 
 */
async function getAllowanceOfUnderlyingToken(accountAddress, cTokenAddress) {
    //Check if we are dealing with cETH
    if (cTokenAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
        return Number.MAX_SAFE_INTEGER;
    }

    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const contract = new web3.eth.Contract(ERC20.abi, cToken.underlyingAddress);

    try {
        const allowance = await contract.methods.allowance(accountAddress, cTokenAddress).call();
        console.log("Account " + accountAddress + " has allowance of " + allowance);

        return allowance;
    } catch (error) {
        console.error(error);
    }
}

/**
 * Takes account and token address as input. Returns the balance of that token in that account.
 * Checks if the token is cETH, since ETH is not an ERC-20 token and getting its corresponding balance is done differently.
 * 
 * @param accountAddress 
 * @param cTokenAddress 
 * @returns                 balance
 */
async function getBalanceOfUnderlyingToken(accountAddress, cTokenAddress) {
    //Check if we are dealing with cETH
    if (cTokenAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
        try {
            const balance = await web3.eth.getBalance(accountAddress);
            console.log("Account " + accountAddress + " has balance of " + balance);

            return balance
        } catch (error) {
            console.error(error);
        }
    }


    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const contract = new web3.eth.Contract(ERC20.abi, cToken.underlyingAddress);

    try {
        const balance = await contract.methods.balanceOf(accountAddress).call();
        console.log("Account " + accountAddress + " has balance of " + balance);

        return balance;
    } catch (error) {
        console.error(error);
    }
}

/**
 * Takes as input a cToken address and an amount. Return that amount adjusted to the number of decimals specified by the underlying token.
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
 * Takes borrow and supply as input and returns the max liquidable amount taking into account the close factor and the incentive.
 * 
 * @param supplyInEth 
 * @param borrowInEth 
 * @param closeFactor 
 * @param incentive 
 * @returns             max liquidable amount
 */
function adjustRepayAmountToSupply(supplyInEth, borrowInEth, closeFactor, incentive) {
    let maxLiquidableAmount = borrowInEth * closeFactor;

    if (maxLiquidableAmount * incentive > supplyInEth) maxLiquidableAmount = supplyInEth / incentive;

    return maxLiquidableAmount;
}

/**
 * Takes a token address and amount (no adjusted decimals) as input. 
 * Returns the maximum amount (adjusted decimals) that fits into the balance of the provided token.
 * 
 * @param borrowedAssetAddress  address of the token from which we are getting the balance
 * @param repayAmount           amount (no adjusted decimals) we want to adjust
 * @returns                     max amount (adjusted decimals) that fits into the balance AND balance
 */
async function adjustRepayAmountToBalance(borrowedAssetAddress, repayAmount) {
    const balance = await getBalanceOfUnderlyingToken("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", borrowedAssetAddress);
    console.log("Balance is " + balance);

    let repayAmountAdjustedDecimals = adjustUnderlyingDecimals(borrowedAssetAddress, repayAmount);

    if (repayAmountAdjustedDecimals > 0.9 * balance) repayAmountAdjustedDecimals = 0.9 * balance;

    return repayAmountAdjustedDecimals;
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
async function getLiquidationDetails(account, closeFactor, incentive) {
    const borrowerAddress = account.address;
    const borrowedAssetAddress = account.maxBorrowAddress;
    const collateralAddress = account.maxSupplyAddress;

    const repayAmount = adjustRepayAmountToSupply(account.maxSupplyInEth, account.maxBorrowInEth, closeFactor, incentive);
    const repayAmountAdjusted = await adjustRepayAmountToBalance(account.maxBorrowAddress, repayAmount);

    return {
        borrowerAddress: borrowerAddress,
        borrowedAssetAddress: borrowedAssetAddress,
        repayAmount: repayAmount,
        repayAmountAdjusted: repayAmountAdjusted,
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
function getProfitInEth(repayTokenAddress, repayAmount, cTokenList, incentive, gasFeesInEth) {
    const cToken = cTokenList.find(cToken => cToken.address === repayTokenAddress);
    const underlyingPriceInEth = new BigNumber(cToken.underlyingPriceInEth);

    console.log("Underlying: " + underlyingPriceInEth);

    const profit = BigNumber(repayAmount).multipliedBy(BigNumber(underlyingPriceInEth)).multipliedBy(BigNumber(incentive - 1)).minus(BigNumber(gasFeesInEth)).toFixed();
    console.log("Profit : " + profit);

    return profit;
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

    const { borrowerAddress, borrowedAssetAddress, repayAmount, repayAmountAdjusted, collateralAddress }
        = await getLiquidationDetails(account, app.state.closeFactor, app.state.incentive);

    console.log("borrowerAddress: " + borrowerAddress);
    console.log("borrowedAssetAddress: " + borrowedAssetAddress);
    console.log("repayAmountAdjusted: " + repayAmountAdjusted);
    console.log("collateralAddress: " + collateralAddress);
    console.log("gasFees: " + gasFeesInEth);

    if (getProfitInEth(borrowedAssetAddress, repayAmount, app.state.cTokens, app.state.incentive, gasFeesInEth) <= 0) {
        console.log("Not profiteable");
        return;
    }

    const allowance = await getAllowanceOfUnderlyingToken("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", borrowedAssetAddress);

    //TODO: add gasFees (have to convert first tokens first)
    if (allowance < repayAmountAdjusted) {
        console.log("Insufficient allowance");
    } else {
        console.log("                        ");
        console.log("________________________");
        console.log("________________________");
        console.log("Executing liquidation...");
        console.log("________________________");
        console.log("________________________");
        console.log("                        ");

        //executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmountAdjusted, collateralAddress, gasPrice);
    }
}

function getcTokenContract(cTokenAddress) {
    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const cTokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

    return cTokenContract;
}

async function executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmountAdjusted, collateralAddress, gasPrice) {
    const contract = new getcTokenContract(borrowedAssetAddress);

    try {
        await web3.eth.personal.unlockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", "$account_password")
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

        await web3.eth.personal.lockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036")
            .then(console.log("Account locked!"));

    }
}