import React, { Component } from "react";
import Header from "./components/Header/index.js";
import AccountsTable from "./components/AccountsTable/index.js";
import TokensTable from "./components/TokensTable/index.js";
import BalanceTable from "./components/BalanceTable/index.js";
import LiquidationMenu from "./components/LiquidationMenu/index.js";
import Comptroller from "./CompoundProtocol/Comptroller.js";
import cTokens from "./CompoundProtocol/cTokens.js";
import GasCosts from "./CompoundProtocol/GasCosts.js";
import OldcTokens from "./CompoundProtocol/OldcTokens.js";
import UniswapAnchoredView from "./CompoundProtocol/UniswapAnchoredView.js";
import ERC20 from "./CompoundProtocol/ERC20.js";
import lookForLiquidations from "./CompoundProtocol/Liquidator.js";
import axios from "axios";
import Web3 from "web3";

// /home/robotito/Crypto/compound_liquidator/.env
//const result = require("dotenv").config({ path: "/home/robotito/Crypto/compound_liquidator/.env" });
//if (result.error) throw result.error;

export const web3 = new Web3("http://192.168.1.2:8545");
//export const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/v3/63bb2d03b65543a1bb50ed173d2c1966"));
export const troll = new web3.eth.Contract(Comptroller.abi, Comptroller.address);
export const UniswapAnchoredViewContract = new web3.eth.Contract(UniswapAnchoredView.abi, UniswapAnchoredView.address);
const ETHValidatorProxy = "0x264BDDFD9D93D48d759FBDB0670bE1C6fDd50236";


const gasURL = "https://ethgasstation.info/api/ethgasAPI.json?api-key=ba3b8b16c8236248538879ebba23562f288a4f93965d58d90b534b2ea44a";
const accountURL = "https://api.compound.finance/api/v2/account";
const cTokenURL = "https://api.compound.finance/api/v2/ctoken";
const accountRequestData = {
  max_health: { value: "1.0" },
  min_borrow_value_in_eth: { value: "0.001" },
  page_size: 500
};

const binanceURL = "https://api.binance.com/api/v3/avgPrice ";
const binanceRequestData = {
  symbol: "ETH"
};

function parseGasResponse(json) {
  console.log("SafeLow: " + json.data.safeLow / 10);
  console.log("Average: " + json.data.average / 10);
  console.log("Fast: " + json.data.fast / 10);
  console.log("Fastest: " + json.data.fastest / 10);

  return [json.data.safeLow / 10, json.data.average / 10, json.data.fast / 10, json.data.fastest / 10];
}

async function parsecTokenDataResponse(json) {
  try {
    const cTokenPromiseList = json.data.cToken.map(async cToken => {
      const tokenContract = new web3.eth.Contract(ERC20.abi, String(cToken.token_address));
      const tokenAllowance = await tokenContract.methods.allowance("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", String(cToken.token_address)).call();

      return {
        address: cToken.token_address,
        symbol: cToken.symbol,
        collateralFactor: cToken.collateral_factor.value,
        underlyingPriceInEth: cToken.underlying_price.value,
        underlyingAddress: cToken.underlying_address,
        allowance: tokenAllowance
      };
    });

    const cTokenList = await Promise.all(cTokenPromiseList);
    return cTokenList;
  } catch (error) {
    console.error(error);
  }
}

function getTokens(accountcTokens, cTokenList) {
  let maxSupplyInEth = 0;
  let maxSupplyAddress = "";
  let maxBorrowInEth = 0;
  let maxBorrowAddress = "";

  const accountcTokenList = accountcTokens.map(token => {
    const underlyingPriceInEth = cTokenList.find(cToken => cToken.address === token.address).underlyingPriceInEth;
    const supply = token.supply_balance_underlying.value;
    const borrow = token.borrow_balance_underlying.value;

    const supplyInEth = supply * underlyingPriceInEth;
    const borrowInEth = borrow * underlyingPriceInEth;

    if (borrowInEth > maxBorrowInEth) {
      maxBorrowInEth = borrowInEth;
      maxBorrowAddress = token.address;
    }
    if (supplyInEth > maxSupplyInEth) {
      maxSupplyInEth = supplyInEth;
      maxSupplyAddress = token.address;
    }

    return {
      address: token.address,
      symbol: token.symbol,
      supply: supply,
      supplyInEth: supplyInEth,
      borrow: borrow,
      borrowInEth: borrowInEth,
      underlyingPriceInEth: underlyingPriceInEth
    }
  });

  return {
    maxSupplyInEth: maxSupplyInEth,
    maxSupplyAddress: maxSupplyAddress,
    maxBorrowInEth: maxBorrowInEth,
    maxBorrowAddress: maxBorrowAddress,
    tokens: accountcTokenList
  }
}


function getProfitPerToken(tokens, app, maxSupplyInEth, maxSupplyAddress) {
  let maxProfitInEth = 0;
  const gasFees = (app.state.gasPrices[3] * GasCosts.liquidateBorrow) / 1e9;

  const profitPerTokenInEth = tokens.filter(token => token.borrow > 0).map(token => {
    let liquidableAmountInEth;
    if (token.address === maxSupplyAddress && OldcTokens.includes(token.address)) {
      liquidableAmountInEth = 0;
    } else {
      liquidableAmountInEth = token.supplyInEth * app.state.closeFactor;
    }

    while (liquidableAmountInEth > maxSupplyInEth) liquidableAmountInEth = maxSupplyInEth;

    const profitInEth = liquidableAmountInEth * (app.state.incentive - 1);
    if (profitInEth > maxProfitInEth) maxProfitInEth = profitInEth;

    return {
      address: token.address,
      symbol: token.symbol,
      profitInEth: profitInEth,
      profitMinusTxFees: profitInEth - gasFees
    }
  });

  return {
    maxProfitInEth: maxProfitInEth,
    profitPerTokenInEth: profitPerTokenInEth
  }
}

function parseAccountDataResponse(json, app, cTokenList) {
  const accountList = json.data.accounts.map(account => {
    const { maxSupplyInEth, maxSupplyAddress, maxBorrowInEth, maxBorrowAddress, tokens } = getTokens(account.tokens, cTokenList);
    const { maxProfitInEth, profitPerTokenInEth } = getProfitPerToken(tokens, app, maxSupplyInEth, maxSupplyAddress);

    return {
      address: account.address,
      health: account.health.value,
      borrowValueInEth: account.total_borrow_value_in_eth.value,
      collateralTimesFactorValueInEth: account.total_collateral_value_in_eth.value,
      tokens: tokens,
      profitPerTokenInEth: profitPerTokenInEth,
      maxSupplyInEth: maxSupplyInEth,
      maxSupplyAddress: maxSupplyAddress,
      maxBorrowInEth: maxBorrowInEth,
      maxBorrowAddress: maxBorrowAddress,
      maxProfitInEth: maxProfitInEth
    }
  });

  accountList.sort((a, b) => b.maxProfitInEth - a.maxProfitInEth);

  console.log(accountList.length);

  return accountList;
}

class App extends Component {
  constructor() {
    super();

    this.web3 = web3;

    this.isBlocked = false;

    this.balances = new Map();
    this.allowances = new Map();

    this.cTokens = [];

    this.state = {
      displayTokens: false,

      addressToInspect: "",
      tokenToRepayAddress: "",
      tokenToCollectAddress: "",
      repayAmount: "",
      repayAmountInEth: "",
      profitInEth: "",

      ethToUsd: "",

      gasPrices: [],

      closeFactor: "",
      incentive: "",

      cTokens: [],
      accounts: []
    };

    this.getAllowanceOfUnderlyingToken = this.getAllowanceOfUnderlyingToken.bind(this);
    this.refreshAllowances = this.refreshAllowances.bind(this);
    this.getBalanceOfUnderlyingToken = this.getBalanceOfUnderlyingToken.bind(this);
    this.refreshBalances = this.refreshBalances.bind(this);
    this.refreshEthToUsd = this.refreshEthToUsd.bind(this);
    this.refreshPrices = this.refreshPrices.bind(this);
    this.refreshCloseFactor = this.refreshCloseFactor.bind(this);
    this.refreshIncentive = this.refreshIncentive.bind(this);
    this.refreshGasPrices = this.refreshGasPrices.bind(this);
    this.refreshAccountList = this.refreshAccountList.bind(this);
    this.refreshcTokenAndAccountList = this.refreshcTokenAndAccountList.bind(this);
  }

  componentDidMount() {
    this.refreshEthToUsd();
    this.refreshCloseFactor();
    this.refreshIncentive();
    this.refreshGasPrices();
    this.refreshcTokenAndAccountList();
    this.refreshBalances();
    this.refreshAllowances();

    setInterval(this.refreshAccountList, 2000);
  }

  /**
   * Takes account and token address as input. Returns the allowance of the underlying token in that account.
   * Checks if the token is cETH, since ETH is not an ERC-20 token and it has no allowance.
   *  
   * @param cTokenAddress 
   * @returns 
   */
  async getAllowanceOfUnderlyingToken(cTokenAddress) {
    //Check if we are dealing with cETH
    if (cTokenAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
      return Number.MAX_SAFE_INTEGER;
    }

    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const contract = new web3.eth.Contract(ERC20.abi, cToken.underlyingAddress);

    try {
      const allowance = await contract.methods.allowance("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036", cTokenAddress).call();
      console.log("Account has allowance of " + allowance + " " + cToken.name.substring(1));

      return allowance;
    } catch (error) {
      console.error(error);
    }
  }

  refreshAllowances() {
    cTokens.forEach(async cToken => {
      const allowance = await this.getAllowanceOfUnderlyingToken(cToken.address);
      this.allowances.set(cToken.address, allowance);
    });

    this.allowances.forEach((values, keys) => {
      console.log(values + " of " + keys);
    });
  }


  /**
   * Takes account and token address as input. Returns the balance of that token in that account.
   * Checks if the token is cETH, since ETH is not an ERC-20 token and getting its corresponding balance is done differently.
   * 
   * @param cTokenAddress 
   * @returns                 balance
   */
  async getBalanceOfUnderlyingToken(cTokenAddress) {
    //Check if we are dealing with cETH
    if (cTokenAddress === "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5") {
      try {
        const balance = await web3.eth.getBalance("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036");
        console.log("Account has balance of " + balance + " ETH");

        return balance
      } catch (error) {
        console.error(error);
      }
    }


    const cToken = cTokens.find(cToken => cToken.address === cTokenAddress);
    const contract = new web3.eth.Contract(ERC20.abi, cToken.underlyingAddress);

    try {
      const balance = await contract.methods.balanceOf("0x5cf30c7fe084be043570b6d4f81dd7132ab3b036").call();
      console.log("Account has balance of " + balance + " " + cToken.name.substring(1));

      return balance;
    } catch (error) {
      console.error(error);
    }
  }

  refreshBalances() {
    cTokens.forEach(async cToken => {
      const balance = await this.getBalanceOfUnderlyingToken(cToken.address);
      this.balances.set(cToken.address, balance);
    });

    this.balances.forEach((values, keys) => {
      console.log(values + " of " + keys);
    });
  }

  async refreshEthToUsd() {
    try {
      //const view = UniswapAnchoredViewContract.at(ETHValidatorProxy);
      //const price = await view.methods.price("ETH").call();
      //console.log(price);
//
      //this.setState({
      //  ethToUsd: price
      //})

      this.setState({
        ethToUsd: 2000
      })
    } catch (error) {
      console.error(error);
    }
  }

  async refreshPrices() {
    try {
      const binanceDataResponse = await axios.get(binanceURL, binanceRequestData);
      console.log(binanceDataResponse);
    } catch (error) {
      console.error(error);
    }
  }

  async refreshCloseFactor() {
    try {
      const closeFactor = await troll.methods.closeFactorMantissa().call() / 1e18;
      console.log(closeFactor);

      this.setState({
        closeFactor: closeFactor
      });
    } catch (error) {
      console.error(error);
    }

  }

  async refreshIncentive() {
    try {
      const incentive = await troll.methods.liquidationIncentiveMantissa().call() / 1e18;
      console.log(incentive);

      this.setState({
        incentive: incentive
      });
    } catch (error) {
      console.error(error);
    }
  }

  async refreshGasPrices() {
    try {
      const gasDataResponse = await axios.get(gasURL);
      const gasPrices = parseGasResponse(gasDataResponse);

      this.setState({
        gasPrices: gasPrices
      });
    } catch (error) {
      console.error(error);
    }
  }

  async refreshAccountList() {
    try {
      if (typeof this.cTokens === "undefined") {
        console.log("cToken list is empty");
        return;
      }

      const cTokenList = this.cTokens;

      console.log("Refreshing account list");
      const accountDataResponse = await axios.post(accountURL, accountRequestData);
      const accountList = parseAccountDataResponse(accountDataResponse, this, cTokenList);

      this.setState({
        accounts: accountList
      });

      console.log("Done refreshing account list");

      lookForLiquidations(accountList, this);
    } catch (error) {
      console.error(error);
    }
  }

  async refreshcTokenAndAccountList() {
    try {
      //Parsing account data requires data from the cToken list
      console.log("Refreshing cToken list");
      const cTokenDataResponse = await axios.get(cTokenURL);
      const cTokenList = await parsecTokenDataResponse(cTokenDataResponse);

      console.log("Refreshing account list")
      const accountDataResponse = await axios.post(accountURL, accountRequestData);
      const accountList = parseAccountDataResponse(accountDataResponse, this, cTokenList);

      this.cTokens = cTokenList;

      this.setState({
        cTokens: cTokenList,
        accounts: accountList
      });

      console.log("Done refreshing cToken and account lists");
    } catch (error) {
      console.error(error);
    }
  }

  render() {
    if (this.state.addressToInspect.length > 0) {
      if (this.state.tokenToRepayAddress.length > 0 && this.state.tokenToCollectAddress.length > 0) {
        return (
          <div className="App">
            <BalanceTable app={this} address={this.state.addressToInspect}></BalanceTable>
            <LiquidationMenu app={this}></LiquidationMenu>
          </div>
        );
      } else {
        return (
          <div className="App">
            <BalanceTable app={this} address={this.state.addressToInspect}></BalanceTable>
          </div>
        );
      }
    }

    if (!this.state.displayTokens) {
      return (
        <div className="App">
          <Header app={this} />
          <button onClick={() => this.setState({ displayTokens: true })}> See cTokens </button>
          <button style={{ float: "right" }} onClick={() => this.refreshcTokenAndAccountList()}> Refresh </button>
          <AccountsTable accounts={this.state.accounts} app={this} ethToUsd={this.state.ethToUsd} />
        </div>
      );
    } else {
      return (
        <div className="App">
          <button onClick={() => this.setState({ displayTokens: false })}> See accounts </button>
          <button style={{ float: "right" }} onClick={this.refreshTokenList}> Refresh </button>
          <TokensTable cTokens={this.state.cTokens} />
        </div>
      );
    }
  }
}
export default App;