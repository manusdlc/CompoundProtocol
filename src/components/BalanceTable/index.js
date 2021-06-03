function uninspectAddress(app) {
    app.setState({
        addressToInspect: ''
    });
}

/*
function repayChecked(app, address) {
    if (app.state.assetToRepay.length > 0) {
        app.setState({
            assetToRepay: ''
        });
    } else {
        app.setState({
            assetToRepay: address
        });
    }
}

function collectChecked(app, address) {
    app.setState({
        assetToCollect: address
    });
}*/

function BalanceTable(props) {
    /* Find corresponding account */
    let account = props.app.state.accounts.find(account => account.address === props.address);

    return (
        <div className="BalanceTable">
            <table>
                <thead>
                    <tr>
                        <td> Symbol </td>
                        <td> Address </td>
                        <td> Supply </td>
                        <td> Borrow </td>
                        <td> Repay </td>
                        <td> Collect </td>
                    </tr>
                </thead>
                <tbody>
                    {
                        account.tokens.map(cToken => {
                            return (
                                <tr key={cToken.address}>
                                    <td> {cToken.symbol} </td>
                                    <td> {cToken.address} </td>
                                    <td>
                                        {cToken.supply} {cToken.symbol}
                                        <br />
                                        {cToken.supplyInEth} ETH
                                    </td>
                                    <td> {cToken.borrow} </td>
                                    <td> <input type="checkbox" id="repayCheck" /> </td>
                                    <td> <input type="checkbox" id="collectCheck" /> </td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </table>
            <button className="BackButton" onClick={() => uninspectAddress(props.app)}>
                Back
            </button>
        </div>
    )
}

export default BalanceTable;