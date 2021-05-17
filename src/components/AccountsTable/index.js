import "./AccountsTable.css";

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
                        <th> Profit w/o TxFees </th>
                    </tr>
                </thead>
                <tbody>
                    {
                        props.accounts.map((account) => {
                            return (
                                <tr key={account.address}>
                                    <td> {account.address} </td>
                                    <td> {account.health} </td>
                                    <td> {account.collateralTimesFactorValueInEth} </td>
                                    <td> {account.borrowValueInEth} </td>
                                    <td>
                                        {
                                            account.tokens.map((token) => {
                                                let supply = token.supply_balance_underlying.value * 1;
                                                let borrow = token.borrow_balance_underlying.value * 1;
                                                return (
                                                    <div key={token.address}>
                                                        <span style={{fontWeight: 'bold'}}> {token.symbol} </span>
                                                        <span text-alignment='center'> Sup: {supply} {"     "} Bor: {borrow} </span>
                                                    </div>
                                                );
                                            })
                                        }
                                    </td>
                                    <td> {account.profitNoTxFees} </td>
                                </tr>
                            );
                        }
                        )
                    }
                </tbody>
            </table>
        </div>
    );
}

export default AccountsTable;