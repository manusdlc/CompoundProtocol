function uninspectAddress(app) {
    app.setState({
        addressToInspect: ''
    })
}

function BalanceTable(props) {
    //Find corrsponding account
    let account = props.app.state.accounts.find(account => account.address === props.address);

    return (
        <div className="BalanceTable">
            <table>
                <thead>
                    <td> Symbol </td>
                    <td> Address </td>
                    <td> Supply </td>
                    <td> Borrow </td>
                </thead>
                <tbody>
                    {
                        account.tokens.map(cToken => {
                            return (
                                <tr key={cToken.address}>
                                    <td> {cToken.symbol} </td>
                                    <td> {cToken.address} </td>
                                    <td> {cToken.supply} </td>
                                    <td> {cToken.borrow} </td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </table>
            <button className="InspectButton" onClick={() => uninspectAddress(props.app)}
            >
                Back
            </button>
        </div>
    )
}

export default BalanceTable;