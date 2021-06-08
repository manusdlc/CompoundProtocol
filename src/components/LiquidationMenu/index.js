import GasCosts from "../../CompoundProtocol/GasCosts.js"

function liquidateAccount() {
    
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
                <button className="LiquidationButton"> Liquidate </button>
            </div>
        </div>
    );
}

export default LiquidationMenu;