import "./AccountsTable.css";

function InspectAddress(address, app) {
    app.setState({
        inspectingAddress: true,
        addressToInspect: address
    });
}

function AccountsTable(props) {
    return (
        <div className="AccountsTable">
            <table>
                <thead>
                    <tr>
                        <th> Address </th>
                        <th> Health </th>
                        <th> Collateral * Factor (Eth) </th>
                        <th> Borrow (Eth) </th>
                        <th> Tokens </th>
                        <th> Profit / token (Eth) </th>
                        <th> Profit / token - TxFee (Eth) </th>
                        <th> Inspection </th>
                    </tr>
                </thead>
                <tbody>
                    {
                        props.accounts.map((account) => {
                            return (
                                <tr key={account.address}>
                                    <td> {account.address} </td>
                                    <td> {account.health} </td>
                                    <td> {(account.collateralTimesFactorValueInEth * 1).toFixed(6)} </td>
                                    <td> {(account.borrowValueInEth * 1).toFixed(6)} </td>
                                    <td>
                                        {
                                            account.tokens.map((token) => {
                                                return (
                                                    <div key={token.address}>
                                                        <span style={{ fontWeight: 'bold' }}> {token.symbol} </span>
                                                        <br />
                                                        <span text-alignment='center'> Sup: {(token.supply * 1).toFixed(6)} </span>
                                                        <span text-alignment='center'> Bor: {(token.borrow * 1).toFixed(6)} </span>
                                                        <span text-alignment='center'> Pro: {(token.profit * 1).toFixed(6)} </span>
                                                        <br />
                                                        <span text-alignment='center'> Sup: {(token.supplyInEth * 1).toFixed(6)} </span>
                                                        <span text-alignment='center'> Bor: {(token.borrowInEth * 1).toFixed(6)} </span>
                                                    </div>
                                                );
                                            })
                                        }
                                    </td>
                                    <td>
                                        {
                                            account.profitPerTokenInEth.map((token) => {
                                                return (
                                                    <div key={token.address}>
                                                        <span style={{ fontWeight: 'bold' }}> {token.symbol} </span>
                                                        <br />
                                                        <span text-alignment='center'> {(token.profitInEth * 1).toFixed(6)} ETH </span>
                                                        <br />
                                                        <span text-alignment='center'> {(token.profitInEth * props.ethToUsd).toFixed(6)} USD </span>
                                                    </div>
                                                );
                                            })
                                        }
                                    </td>
                                    <td>
                                        {
                                            account.profitPerTokenInEth.map((token) => {
                                                return (
                                                    <div key={token.address}>
                                                        <span style={{ fontWeight: 'bold' }}> {token.symbol} </span>
                                                        <br />
                                                        <span text-alignment='center'> {(token.profitMinusTxFees * 1).toFixed(6)} ETH </span>
                                                        <br />
                                                        <span text-alignment='center'> {(token.profitMinusTxFees * props.ethToUsd).toFixed(6)} USD </span>
                                                    </div>
                                                );
                                            })
                                        }
                                    </td>
                                    <td>
                                        <button
                                            className="InspectButton"
                                            onClick={() => InspectAddress(account.address, props.app)}
                                        >
                                            Inspect
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </table>
        </div>
    );
}

export default AccountsTable;