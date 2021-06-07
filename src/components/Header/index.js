import GasCosts from '../../CompoundProtocol/GasCosts.js';

function Header(props) {
    let app = props.app;
    let liquidationFee = app.state.gasPrices[1] * GasCosts.liquidateBorrow;

    return (
        <div className="Header">
            <button style={{ float: 'right' }} onClick={() => app.refreshEthToUsd()}> Refresh </button>
            <h3> ETH - USD  </h3>
            <span> {app.state.ethToUsd} USD </span>
            <button style={{ float: 'right' }} onClick={() => app.refreshGasPrices()}> Refresh </button>
            <h3> Gas Price (GWEI) </h3>
            <span> Safe: {app.state.gasPrices[0] / 1e9}, Propose: {app.state.gasPrices[1] / 1e9}, Fast: {app.state.gasPrices[2] / 1e9}  </span>
            <h3> Liquidation Fee  </h3>
            <span> {liquidationFee} WEI, </span>
            <span> {liquidationFee / 1e9} GWEI, </span>
            <span> {liquidationFee / 1e18} ETH, </span>
            <span> {(liquidationFee / 1e18) * app.state.ethToUsd} USD </span>
        </div>
    );
}

export default Header;