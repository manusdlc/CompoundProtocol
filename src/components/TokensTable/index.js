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
                    </tr>
                </thead>
                <tbody>
                    {
                        props.cTokens.map((cToken) => {
                            return (
                                <tr key={cToken.address}>
                                    <td> {cToken.address} </td>
                                    <td> {cToken.symbol} </td>
                                    <td> {cToken.collateralFactor} </td>
                                    <td> {cToken.underlyingPriceInEth} </td>
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