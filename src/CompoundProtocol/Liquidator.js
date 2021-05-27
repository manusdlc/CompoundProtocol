//function liquidateborrowedAddressw(address borrowedAddresswer, uint amount, address collateral) returns (uint)


//DESTRUCTURING

function getcTokenContract(borrowedAddress) {

}

function getMostProfiteable(accountList) {
    return accountList[0];
}

function getCollaterals(account) {
    return account.tokens.filter(token => token.supply > 0).map(token => {
        return {
            address: token.address,
            supply: token.supply,
            supplyInEth: token.supplyInEth,
            underlyingPriceInEth: token.underlyingPriceInEth
        };
    });
}

function getborrowedAddressws(account) {
    return account.tokens.filter(token => token.borrowedAddressw > 0).map(token => {
        return {
            address: token.address,
            borrowedAddressw: token.borrowedAddressw,
            borrowedAddresswInEth: token.borrowedAddresswInEth,
            underlyingPriceInEth: token.underlyingPriceInEth
        }
    });
}

function getMaxCollateral(account) {
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
        maxSupply: maxSupply,
        maxSupplyInEth: maxSupplyInEth
    };
}

function getAmountAndCollateral(account, closeFactor, incentive) {
    let { suppliedAddress, maxSupply, maxSupplyInEth } = getMaxCollateral(account);

    let borrowedAddress = '';
    let maxBorrow = 0;
    let maxBorrowInEth = 0;
    let underlyingPriceInEth = 0;

    account.tokens.forEach(token => {
        if (token.borrowInEth > maxBorrowInEth) {
            borrowedAddress = token.address;
            maxBorrow = token.borrow;
            maxBorrowInEth = token.borrowInEth;
            underlyingPriceInEth = token.underlyingPriceInEth;
        }
    });

    let maxLiquidableAmountInEth = maxBorrowInEth * closeFactor;
    while (maxLiquidableAmountInEth * incentive > maxSupplyInEth) maxLiquidableAmountInEth -= 0.0001;

    let maxLiquidableAmount = maxLiquidableAmountInEth / underlyingPriceInEth;

    return {
        borrowedAddress: borrowedAddress,
        amount: maxLiquidableAmount,
        suppliedAddress: suppliedAddress
    };
}

function getLiquidationDetails(account, closeFactor, incentive) {
    let { borrowedAddress, amount, suppliedAddress } = getAmountAndCollateral(account, closeFactor, incentive);

    return {
        borrower: account.address,
        borrowedAddress: borrowedAddress,
        amount: amount,
        suppliedAddress: suppliedAddress
    };
}

async function liquidateAccount(account, closeFactor, incentive) {
    let { borrower, borrowedAddress, amount, suppliedAddress } = getLiquidationDetails(account, closeFactor, incentive);

    const borrowedContract = getcTokenContract(borrowedAddress);
}