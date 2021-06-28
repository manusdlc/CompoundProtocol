import "./TokensTable.css";

function TokensTable(props) {
    return (
        <div className="TokensTable">
            <table>
                <thead>
                    <tr>
                        <th> Address </th>
                        <th> Symbol </th>
                        <th> Collateral Factor </th>
                        <th> Underlying Price (Eth) </th>
                        <th> Allowance </th>
                        <th> Underlying address </th>
                    </tr>
                </thead>
                <tbody>
                    {
                        props.cTokens.map(cToken => {
                            return (
                                <tr key={cToken.address}>
                                    <td> {cToken.address} </td>
                                    <td> {cToken.symbol} </td>
                                    <td> {cToken.collateralFactor} </td>
                                    <td> {cToken.underlyingPriceInEth} </td>
                                    <td> {cToken.allowance} </td>
                                    <td> {cToken.underlyingAddress} </td>
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

export default TokensTable;