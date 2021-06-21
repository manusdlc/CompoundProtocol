import GasCosts from "../../CompoundProtocol/GasCosts.js";
import cTokens from "../../CompoundProtocol/cTokens.js";
import Web3 from "web3";
import BigNumber from "bignumber.js";

export const web3 = new Web3("http://192.168.1.2:8545");

function getcTokenContract(cTokenAddress) {
    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const cTokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

    return {
        contract: cTokenContract,
        symbol: cToken.name
    };
}

async function getBalanceOfToken(accountAddress, cTokenAddress) {
    const { contract, symbol } = getcTokenContract(cTokenAddress);
    const balance = await contract.methods.balanceOf(accountAddress).call();

    console.log("Account " + accountAddress + " has " + balance +  " "  + symbol);

    return balance;
}

function adjustUnderlyingDecimals(cTokenAddress, repayAmount) {
    const underlyingDecimals = cTokens.find(cToken => cToken.address === cTokenAddress).underlyingDecimals;
    const repayAmountDecimals = new BigNumber(repayAmount).multipliedBy(BigNumber(10).exponentiatedBy(underlyingDecimals)).toFixed();

    console.log("Adjusted decimals: " + repayAmountDecimals);

    return repayAmountDecimals;
}

async function executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmount, collateralAddress, gasPrice) {
    const cTokenContract = getcTokenContract(borrowedAssetAddress);
    const balance = await getBalanceOfToken("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", borrowedAssetAddress);

    if (0.9 * balance > repayAmount) {
        const repayAmountDecimals = adjustUnderlyingDecimals(borrowedAssetAddress, repayAmount);

        try {
            //Check if the borrowed asset is cETH
            if (borrowedAssetAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
                await web3.eth.personal.unlockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", "")
                    .then(console.log("Account unlocked!"));

                await cTokenContract.methods.liquidateBorrow(borrowerAddress, collateralAddress).send({
                    from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036",
                    value: repayAmountDecimals,
                    gas: GasCosts.liquidateBorrow,
                    gasPrice: gasPrice
                }).on("transactionHash", function (hash) {
                    console.log("Operation's hash: " + hash);
                }).on("confirmation", function (confNumber, receipt, latestBlockHash) {
                    console.log("Operation has been confirmed. Number: " + confNumber);
                    console.log("Receipt: " + receipt);
                }).on("error", function (error) {
                    console.error(error);
                }).then(function (receipt) {
                    console.log("The receipt: ");
                    console.log(receipt);
                    console.log("Has been mined");
                });

                await web3.eth.personal.lockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036")
                    .then(console.log("Account locked!"));
            } else {
                await web3.eth.personal.unlockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", "")
                    .then(console.log("Account unlocked!"));

                await cTokenContract.methods.liquidateBorrow(borrowerAddress, repayAmountDecimals, collateralAddress).send({
                    from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036",
                    gas: GasCosts.liquidateBorrow,
                    gasPrice: gasPrice
                }).on("transactionHash", function (hash) {
                    console.log("Operation's hash: " + hash);
                }).on("confirmation", function (confNumber, receipt, latestBlockHash) {
                    console.log("Operation has been confirmed. Number: " + confNumber);
                    console.log("Receipt: " + receipt);
                }).on("error", function (error) {
                    console.error(error);
                }).then(function (receipt) {
                    console.log("The receipt: ");
                    console.log(receipt);
                    console.log("Has been mined");
                });

                await web3.eth.personal.lockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036")
                    .then(console.log("Account locked!"));
            }
        } catch (error) {
            console.error(error);
        }
    } else {
        console.log("Insufficient funds");
    }
}

function liquidateAccount(app) {
    const borrowerAddress = app.state.addressToInspect;
    const borrowedAssetAddress = app.state.tokenToRepayAddress;

    const repayAmount = app.state.repayAmount;

    const collateralAddress = app.state.tokenToCollectAddress;
    const gasPrice = BigNumber(app.state.gasPrices[3]).multipliedBy(BigNumber(10).exponentiatedBy(9)).toFixed();

    console.log("borrowerAddress: " + borrowerAddress);
    console.log("borrowedAssetAddress: " + borrowedAssetAddress);
    console.log("repayAmount: " + repayAmount);
    console.log("collateralAddress: " + collateralAddress);
    console.log("gasPrice: " + gasPrice);

    executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmount, collateralAddress, gasPrice);
}

function getRepayAmount(tokenToRepay, closeFactor) {
    let slider = document.getElementById("liquidationSlider");

    return {
        repayAmount: (slider.value * tokenToRepay.borrow * closeFactor) / 100,
        repayAmountInEth: (slider.value * tokenToRepay.borrowInEth * closeFactor) / 100
    };
}

function getProfit(repayAmountInEth, tokenToCollect, incentive, gasPrices) {
    let profitInEth = repayAmountInEth * (incentive - 1);
    let collateralInEth = tokenToCollect.supplyInEth;
    let txFees = (gasPrices[3] * GasCosts.liquidateBorrow) / 1e9;

    if (repayAmountInEth * incentive <= collateralInEth) {
        return profitInEth - txFees;
    } else {
        return collateralInEth - repayAmountInEth - txFees;
    }
}

function updateValues(app, tokenToRepay, tokenToCollect) {
    let { repayAmount, repayAmountInEth } = getRepayAmount(tokenToRepay, app.state.closeFactor);
    let profitInEth = getProfit(repayAmountInEth, tokenToCollect, app.state.incentive, app.state.gasPrices);

    app.setState({
        repayAmount: repayAmount,
        repayAmountInEth: repayAmountInEth,
        profitInEth: profitInEth
    });
}

function LiquidationMenu(props) {
    let app = props.app;
    let account = app.state.accounts.find(account => account.address === app.state.addressToInspect);
    let tokenToRepay = account.tokens.find(token => token.address === app.state.tokenToRepayAddress);
    let tokenToCollect = account.tokens.find(token => token.address === app.state.tokenToCollectAddress);

    return (
        <div className="LiquidationMenu">
            <div className="Tokens">
                <div className="tokenToRepay">
                    <p> Asset to Repay: {tokenToRepay.symbol} </p>
                    <p> Borrow: {tokenToRepay.borrow} {String(tokenToRepay.symbol).substring(1)} </p>
                    <p> {tokenToRepay.borrowInEth} ETH </p>
                </div>
                <div className="tokenToCollect">
                    <p> Asset to Collect: {tokenToCollect.symbol} </p>
                    <p> Supply: {tokenToCollect.supply} {String(tokenToCollect.symbol).substring(1)} </p>
                    <p> {tokenToCollect.supplyInEth} ETH </p>
                </div>
            </div>
            <div className="LiquidationDetails">
                <input type="range" className="slider" min="0" max="100" id="liquidationSlider" onInput={() => updateValues(app, tokenToRepay, tokenToCollect)} />
                <p> Repaying: {app.state.repayAmount} {String(tokenToRepay.symbol).substring(1)} </p>
                <p> Repaying: {app.state.repayAmountInEth} ETH </p>
                <p> Profit: {app.state.profitInEth} ETH </p>
                <button className="LiquidationButton" onClick={() => liquidateAccount(app)}> Liquidate </button>
            </div>
        </div>
    );
}

export default LiquidationMenu;