import GasCosts from '../../CompoundProtocol/GasCosts.js';

function Header(props) {
    let app = props.app;
    let liquidationFee = app.state.gasPrices[3] * GasCosts.liquidateBorrow;

    return (
        <div className="Header">
            <button style={{ float: 'right' }} onClick={() => app.refreshEthToUsd()}> Refresh </button>
            <h3> ETH - USD  </h3>
            <span> {app.state.ethToUsd} USD </span>
            <button style={{ float: 'right' }} onClick={() => app.refreshGasPrices()}> Refresh </button>
            <h3> Gas Price (GWEI) </h3>
            <span> Safe: {app.state.gasPrices[0]}, Average: {app.state.gasPrices[1]}, Fast: {app.state.gasPrices[2]}, Fastest: {app.state.gasPrices[3]}  </span>
            <h3> Liquidation Fee  </h3>
            <span> {liquidationFee} GWEI, </span>
            <span> {liquidationFee / 1e9} ETH, </span>
            <span> {(liquidationFee / 1e9) * app.state.ethToUsd} USD </span>
        </div>
    );
}

export default Header;