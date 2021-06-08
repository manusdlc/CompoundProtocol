function uninspectAddress(app) {
    app.setState({
        addressToInspect: "",
        tokenToRepay: "",
        tokenToCollect: "",
        repayAmount: "",
        repayAmountInEth: "",
        profitInEth: ""
    });
}

function repayAssetClicked(app, address) {
    app.setState({
        tokenToRepay: address
    });

    app.state.cTokens.forEach(cToken => {
        if (cToken.address !== address) {
            let radioButton = document.getElementById(String(cToken.address) + "_repay");

            if (radioButton !== null) {
                radioButton.checked = false;
            }
        }
    });
}

function collectAssetClicked(app, address) {
    app.setState({
        tokenToCollect: address
    });

    app.state.cTokens.forEach(cToken => {
        if (cToken.address !== address) {
            let radioButton = document.getElementById(String(cToken.address) + "_collect");

            if (radioButton !== null) {
                radioButton.checked = false;
            }
        }
    });
}

function BalanceTable(props) {
    /* Find corresponding account */
    let account = props.app.state.accounts.find(account => account.address === props.address);

    return (
        <div className="BalanceTable">
            <p> Health: {account.health} </p>
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
                                        {cToken.supply} {String(cToken.symbol).substring(1)}
                                        <br />
                                        {cToken.supplyInEth} ETH
                                    </td>
                                    <td>
                                        {cToken.borrow} {String(cToken.symbol).substring(1)}
                                        <br />
                                        {cToken.borrowInEth} ETH
                                    </td>
                                    <td> <input type="radio"
                                        id={String(cToken.address) + "_repay"}
                                        onClick={() => repayAssetClicked(props.app, cToken.address)} />
                                    </td>
                                    <td> <input type="radio"
                                        id={String(cToken.address) + "_collect"}
                                        onClick={() => collectAssetClicked(props.app, cToken.address)} />
                                    </td>
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