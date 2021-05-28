import cTokens from 'cTokens.js'
import myAccount from 'myAccount.js'

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

function getBorrows(account) {
    return account.tokens.filter(token => token.borrow > 0).map(token => {
        return {
            address: token.address,
            borrow: token.borrow,
            borrowInEth: token.borrowInEth,
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
        borrowerAddress: account.address,
        borrowedAddress: borrowedAddress,
        amount: amount,
        suppliedAddress: suppliedAddress
    };
}

function getcTokenContract(borrowedAddress) {
    let cToken = cTokens.find(cToken => cToken.address === borrowedAddress);
    const cTokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

    return cTokenContract;
}

async function liquidateAccount(account, closeFactor, incentive, gasPrice) {
    let { borrowerAddress, borrowedAddress, amount, suppliedAddress } = getLiquidationDetails(account, closeFactor, incentive);

    const borrowedContract = getcTokenContract(borrowedAddress);

    /* Check if we are liquidating cETH */
    if (borrowedAddress === '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5') {
        amountInWEI = (amount * 1e18).toString();

        const trx = await borrowedContract.methods.liquidateBorrow(borrowerAddress, suppliedAddress).send({
            from: myAccount.address,
            value: amountInWEI,
            gas: 400000,
            gasPrice: gasPrice
        });
    } else {
        const trx = await borrowedContract.methods.liquidateBorrow(borrowedAddress, amount.toString(), suppliedAddress).send({
            from: myAccount.address,
            gas: 400000,
            gasPrice: gasPrice
        });
    }
}