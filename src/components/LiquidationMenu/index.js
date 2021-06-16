import GasCosts from "../../CompoundProtocol/GasCosts.js"
import cTokens from "../../CompoundProtocol/cTokens.js"
import BigNumber from "bignumber.js"

function getcTokenContract(cTokenAddress, web3) {
    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const cTokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

    return cTokenContract;
}

async function executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmount, collateralAddress, gasPrice) {
    const cTokenContract = getcTokenContract(borrowedAssetAddress);

    //Check if the borrowed asset is cETH
    try {
        if (borrowedAssetAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
            const liquidation = await cTokenContract.methods.liquidateBorrow(borrowerAddress, collateralAddress).send({
                from: "0x47E01860F048c12449Bc31d1574566E7905A0880",
                value: repayAmount,
                gas: 400000,
                gasPrice: gasPrice
            });

            if (liquidation.events && liquidation.events.Failure) {
                const errorCode = liquidation.events.Failure.returnValues.error;
                console.error("liquidation error, code " + errorCode);
            }
        } else {
            const liquidation = await cTokenContract.methods.liquidateBorrow(borrowerAddress, repayAmount, collateralAddress).send({
                from: "0x47E01860F048c12449Bc31d1574566E7905A0880",
                gas: 400000,
                gasPrice: gasPrice
            });

            if (liquidation.events && liquidation.events.Failure) {
                const errorCode = liquidation.events.Failure.returnValues.error;
                console.error("liquidation error, code " + errorCode);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

function liquidateAccount() {
    //Adjust repayAmount to the corresponding decimals
    

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
    let txFees = (gasPrices[1] * GasCosts.liquidateBorrow) / 1e18;

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
    let account = app.state.accounts.find(account => account.address === props.accountAddress);
    let tokenToRepay = account.tokens.find(token => token.address === props.tokenToRepay);
    let tokenToCollect = account.tokens.find(token => token.address === props.tokenToCollect);

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
                <button className="LiquidationButton" oncClick={() => liquidateAccount()}> Liquidate </button>
            </div>
        </div>
    );
}

export default LiquidationMenu;