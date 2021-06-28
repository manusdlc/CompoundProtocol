import GasCosts from "../../CompoundProtocol/GasCosts.js";
import cTokens from "../../CompoundProtocol/cTokens.js";
import ERC20 from "../../CompoundProtocol/ERC20";
import Web3 from "web3";
import BigNumber from "bignumber.js";

export const web3 = new Web3("http://192.168.1.2:8545");


function getERC20Contract(ERC20Address) {
    const contract = new web3.eth.Contract(ERC20.abi, ERC20Address);

    return contract;
}

function getcTokenContract(cTokenAddress) {
    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const cTokenContract = new web3.eth.Contract(cToken.abi, cToken.address);

    return {
        contract: cTokenContract,
        symbol: cToken.name
    };
}

function adjustUnderlyingDecimals(cTokenAddress, repayAmount) {
    const underlyingDecimals = cTokens.find(cToken => cToken.address === cTokenAddress).underlyingDecimals;
    const repayAmountDecimals = new BigNumber(repayAmount).multipliedBy(BigNumber(10).exponentiatedBy(underlyingDecimals)).toFixed();

    console.log("Adjusted decimals: " + repayAmountDecimals);

    return repayAmountDecimals;
}

//async function getGasEstimationOfLiquidationETH(contract, borrowerAddress, collateralAddress) {
//    const gasEstimation = await contract.methods.liquidateBorrow(borrowerAddress, collateralAddress)
//        .estimateGas({ from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036" });
//
//    return gasEstimation;
//}
//
//async function getGasEstimationOfLiquidation(contract, borrowerAddress, repayAmountDecimals, collateralAddress) {
//    const gasEstimation = await contract.methods.liquidateBorrow(borrowerAddress, repayAmountDecimals, collateralAddress)
//        .estimateGas({ from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036" });
//
//    return gasEstimation;
//}

async function executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmount, collateralAddress, gasPrice) {
    const { contract, } = getcTokenContract(borrowedAssetAddress);

    //Adjust to the number of decimals of the underlying token
    const repayAmountDecimals = adjustUnderlyingDecimals(borrowedAssetAddress, repayAmount);

    try {
        await web3.eth.personal.unlockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", "$account_password")
            .then(console.log("Account unlocked!"));

        //Check if the borrowed asset is cETH
        if (borrowedAssetAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {

            await contract.methods.liquidateBorrow(borrowerAddress, collateralAddress).send({
                from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036",
                value: repayAmountDecimals,
                gas: 1000000,
                gasPrice: gasPrice
            }).on("transactionHash", function (hash) {
                console.log("Operation's hash: " + hash);
            }).on("confirmation", function (confNumber, receipt, latestBlockHash) {
                console.log("Operation has been confirmed. Number: " + confNumber);
                console.log("Latest block: " + latestBlockHash);
                console.log("Receipt: " + receipt);
            }).on("error", function (error) {
                console.error(error);
            }).then(function (receipt) {
                console.log("The receipt: ");
                console.log(receipt);
                console.log("Has been mined");
            })
        } else {

            await contract.methods.liquidateBorrow(borrowerAddress, repayAmountDecimals, collateralAddress).send({
                from: "0x5cf30c7fe084be043570b6d4f81dd7132ab3b036",
                gas: 1000000,
                gasPrice: gasPrice
            }).on("transactionHash", function (hash) {
                console.log("Operation's hash: " + hash);
            }).on("confirmation", function (confNumber, receipt, latestBlockHash) {
                console.log("Operation has been confirmed. Number: " + confNumber);
                console.log("Latest block: " + latestBlockHash);
                console.log("Receipt: " + receipt);
            }).on("error", function (error) {
                console.error(error);
            }).then(function (receipt) {
                console.log("The receipt: ");
                console.log(receipt);
                console.log("Has been mined");
            });
        }

    } catch (error) {

        console.error(error);

    } finally {

        await web3.eth.personal.lockAccount("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036")
            .then(console.log("Account locked!"));

    }
}

async function getBalanceOfUnderlyingToken(accountAddress, cTokenAddress) {
    //Check if we are dealing with cETH
    if (cTokenAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
        try {
            const balance = await web3.eth.getBalance(accountAddress);
            console.log("Account " + accountAddress + " has balance of " + balance);
            
            return balance
        } catch (error) {
            console.error(error);
        }
    }


    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const contract = getERC20Contract(cToken.underlyingAddress);

    try {
        const balance = await contract.methods.balanceOf(accountAddress).call();
        console.log("Account " + accountAddress + " has balance of " + balance);

        return balance;
    } catch (error) {
        console.error(error);
    }
}

async function getAllowanceOfUnderlyingToken(accountAddress, cTokenAddress) {
    //Check if we are dealing with cETH
    if (cTokenAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
        return Number.MAX_SAFE_INTEGER;
    }

    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const contract = getERC20Contract(cToken.underlyingAddress);

    try {
        const allowance = await contract.methods.allowance(accountAddress, cTokenAddress).call();
        console.log("Account " + accountAddress + " has allowance of " + allowance);

        return allowance;
    } catch (error) {
        console.error(error);
    }
}

async function liquidateAccount(app) {
    const borrowerAddress = app.state.addressToInspect;
    const borrowedAssetAddress = app.state.tokenToRepayAddress;

    const repayAmount = app.state.repayAmount;

    const collateralAddress = app.state.tokenToCollectAddress;
    const gasPrice = BigNumber(app.state.gasPrices[1]).multipliedBy(BigNumber(10).exponentiatedBy(9)).toFixed();

    console.log("borrowerAddress: " + borrowerAddress);
    console.log("borrowedAssetAddress: " + borrowedAssetAddress);
    console.log("repayAmount: " + repayAmount);
    console.log("collateralAddress: " + collateralAddress);
    console.log("gasPrice: " + gasPrice);

    const balance = await getBalanceOfUnderlyingToken("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", borrowedAssetAddress);
    const allowance = await getAllowanceOfUnderlyingToken("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", borrowedAssetAddress);

    if (0.9 * balance < repayAmount) {
        console.log("Insufficient funds");
    } else if (allowance < repayAmount) {
        console.log("Insufficient allowance");
    } else {
        console.log("Executing liquidation...");
        //executeLiquidation(borrowerAddress, borrowedAssetAddress, repayAmount, collateralAddress, gasPrice);
    }
}

function getRepayAmountSlider(tokenToRepay, closeFactor) {
    let slider = document.getElementById("liquidationSlider");

    return {
        repayAmount: (slider.value * tokenToRepay.borrow * closeFactor) / 100,
        repayAmountInEth: (slider.value * tokenToRepay.borrowInEth * closeFactor) / 100
    };
}

function getRepayAmountBox(tokenToRepay) {
    let box = document.getElementById("liquidationBox");

    return {
        repayAmount: box.value,
        repayAmountInEth: (box.value * tokenToRepay.borrowInEth) / tokenToRepay.borrow
    }
}

function getProfit(repayAmountInEth, tokenToCollect, incentive, gasPrices) {
    let profitInEth = repayAmountInEth * (incentive - 1);
    let collateralInEth = tokenToCollect.supplyInEth;
    let txFees = (gasPrices[3] * GasCosts.liquidateBorrow) / 1e9;

    if (repayAmountInEth * incentive <= collateralInEth) {
        return profitInEth - txFees;
    } else {
        return collateralInEth - repayAmountInEth - txFees;
    }
}

function updateValuesSlider(app, tokenToRepay, tokenToCollect) {
    let { repayAmount, repayAmountInEth } = getRepayAmountSlider(tokenToRepay, app.state.closeFactor);
    let profitInEth = getProfit(repayAmountInEth, tokenToCollect, app.state.incentive, app.state.gasPrices);

    app.setState({
        repayAmount: repayAmount,
        repayAmountInEth: repayAmountInEth,
        profitInEth: profitInEth
    });
}

function updateValuesBox(app, tokenToRepay, tokenToCollect) {
    let { repayAmount, repayAmountInEth } = getRepayAmountBox(tokenToRepay);
    let profitInEth = getProfit(repayAmountInEth, tokenToCollect, app.state.incentive, app.state.gasPrices);

    app.setState({
        repayAmount: repayAmount,
        repayAmountInEth: repayAmountInEth,
        profitInEth: profitInEth
    });
}

function LiquidationMenu(props) {
    let app = props.app;
    let account = app.state.accounts.find(account => account.address === app.state.addressToInspect);
    let tokenToRepay = account.tokens.find(token => token.address === app.state.tokenToRepayAddress);
    let tokenToCollect = account.tokens.find(token => token.address === app.state.tokenToCollectAddress);

    return (
        <div className="LiquidationMenu">
            <div className="Tokens">
                <div className="tokenToRepay">
                    <p> Asset to Repay: {tokenToRepay.symbol} </p>
                    <p> Borrow: {tokenToRepay.borrow} {String(tokenToRepay.symbol).substring(1)} </p>
                    <p> {tokenToRepay.borrowInEth} ETH </p>
                </div>
                <div className="tokenToCollect">
                    <p> Asset to Collect: {tokenToCollect.symbol} </p>
                    <p> Supply: {tokenToCollect.supply} {String(tokenToCollect.symbol).substring(1)} </p>
                    <p> {tokenToCollect.supplyInEth} ETH </p>
                </div>
            </div>
            <div className="LiquidationDetails">
                <input type="text" placeholder="Repay" id="liquidationBox" onKeyUp={() => updateValuesBox(app, tokenToRepay, tokenToCollect)}></input>
                <input type="range" className="slider" min="0" max="100" id="liquidationSlider" onInput={() => updateValuesSlider(app, tokenToRepay, tokenToCollect)} />
                <p> Repaying: {app.state.repayAmount} {String(tokenToRepay.symbol).substring(1)} </p>
                <p> Repaying: {app.state.repayAmountInEth} ETH </p>
                <p> Profit: {app.state.profitInEth} ETH </p>
                <button className="LiquidationButton" onClick={() => liquidateAccount(app)}> Liquidate </button>
            </div>
        </div>
    );
}

export default LiquidationMenu;