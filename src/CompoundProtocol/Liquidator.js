//function liquidateBorrow(address borrower, uint amount, address collateral) returns (uint)


//DESTRUCTURING

function getMostProfiteable(accountList) {
    return accountList[0];
}

function getMaxCollateralAddress(account) {
    let maxSupplyInEth = 0;
    let maxSupply = 0;
    let address = '';
    
    account.tokens.forEach(token => {
        if (token.maxSupplyInEth > maxSupplyInEth) {
            maxSupplyInEth = token.maxSupplyInEth;
            maxSupply = token.maxSupply;
            address = token.address;
        }
    });

    return {
        address: address,
        maxSupplyInEth: maxSupplyInEth,
        maxSupply: maxSupply
    };
}

function getAmountAndCollateralAddress(account, closeFactor, incentive) {
    let maxSupplyAndCollateralAddress = getMaxCollateralAddress(account);
    let maxSupplyInEth = maxSupplyAndCollateralAddress.maxSupplyInEth;
    let collateralAddress = maxSupplyAndCollateralAddress.collateralAddress;

    let cTokenAdress = '';
    let maxBorrowInEth = 0;
    let maxBorrow = 0;
    let underlyingPriceInEth = 0;
    
    account.tokens.forEach(token => {
        if (token.borrowInEth > maxBorrowInEth) {
            cTokenAdress = token.address;
            maxBorrowInEth = token.borrowInEth;
            maxBorrow = token.borrow;
            underlyingPriceInEth = token.underlyingPriceInEth;
        }
    });

    let maxLiquidableAmountInEth = maxBorrowInEth * closeFactor;
    while (maxLiquidableAmountInEth * incentive > maxSupplyInEth) maxLiquidableAmountInEth -= 0.0001;

    let maxLiquidableAmount = maxLiquidableAmountInEth / underlyingPriceInEth;

    return {
        cTokenAdress: cTokenAdress,
        amount: maxLiquidableAmount,
        collateralAddress: collateralAddress
    };
}

function getLiquidationDetails(account, closeFactor, incentive) {
    let amountAndCollateralAddress = getAmountAndCollateralAddress(account, closeFactor, incentive);

    let cTokenAddress = amountAndCollateralAddress.cTokenAdress;
    let amount = amountAndCollateralAddress.amount;
    let collateralAddress = amountAndCollateralAddress.collateralAddress;

    return {
        borrowerAddress: account.address,
        cTokenAddress: cTokenAddress,
        amount: amount,
        collateralAddress: collateralAddress
    };
}

function getcTokenContract(cTokenAdress) {

}

async function liquidateAccount(account, closeFactor, incentive) {
    let liquidationDetails = getLiquidationDetails(account, closeFactor, incentive);

    let cTokenAdress = liquidationDetails.cTokenAddress;

    const cTokenContract = getcTokenContract(cTokenAdress);

    let borrowerAdress = liquidationDetails.borrowerAddress;
    let amount 
}