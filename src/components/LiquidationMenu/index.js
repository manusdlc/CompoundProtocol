import GasCosts from "../../CompoundProtocol/GasCosts.js";
import cTokens from "../../CompoundProtocol/cTokens.js";
import web3 from "../../App.js";
import BigNumber from "bignumber.js";

function getcTokenContract(cTokenAddress) {
    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const cTokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

    return cTokenContract;
}

async function executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmount, collateralAddress, gasPrice) {
    const cTokenContract = getcTokenContract(borrowedAssetAddress);


    try {
        //Check if the borrowed asset is cETH
        if (borrowedAssetAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
            await cTokenContract.methods.liquidateBorrow(borrowerAddress, collateralAddress).send({
                from: "0x47E01860F048c12449Bc31d1574566E7905A0880",
                value: repayAmount,
                gas: 400000,
                gasPrice: gasPrice
            }).once("transactionHash", function(hash){
                console.log("Operation's hash: " + hash);
            }).on("confirmation", function(confNumber, receipt, latestBlockHash){
                console.log("Operation has been confirmed. Number: " + confNumber);
                console.log("Receipt: " + receipt);
            }).on("error", function(error){
                console.error(error);
            });
        } else {
            await cTokenContract.methods.liquidateBorrow(borrowerAddress, repayAmount, collateralAddress).send({
                from: "0x47E01860F048c12449Bc31d1574566E7905A0880",
                gas: 400000,
                gasPrice: gasPrice
            }).once("transactionHash", function(hash){
                console.log("Operation's hash: " + hash);
            }).on("confirmation", function(confNumber, receipt, latestBlockHash){
                console.log("Operation has been confirmed. Number: " + confNumber);
                console.log("Receipt: " + receipt);
            }).on("error", function(error){
                console.error(error);
            });
        }
    } catch (error) {
        console.error(error);
    }
}

function liquidateAccount(app) {
    const borrowerAddress = app.state.addressToInspect;
    const borrowedAssetAddress = app.state.tokenToRepayAddress;

    //Adjust repayAmount to the corresponding underlying decimals
    const underlyingDecimals = cTokens.find(cToken => cToken.address === app.state.tokenToRepayAddress).underlyingDecimals;
    const repayAmountDecimals = new BigNumber(app.state.repayAmount * Math.pow(10, underlyingDecimals)).toFixed();

    const collateralAddress = app.state.tokenToCollectAddress;
    const gasPrice = app.state.gasPrices[3];

    console.log("borrowerAddress: " + borrowerAddress);
    console.log("borrowedAssetAddress: " + borrowedAssetAddress);
    console.log("repayAmountDecimals: " + repayAmountDecimals);
    console.log("collateralAddress: " + collateralAddress);
    console.log("gasPrice: " + gasPrice);
    //executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmountDecimals, collateralAddress, gasPrice);
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