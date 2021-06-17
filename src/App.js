import React, { Component } from "react";
import Header from "./components/Header/index.js";
import AccountsTable from "./components/AccountsTable/index.js";
import TokensTable from "./components/TokensTable/index.js";
import BalanceTable from "./components/BalanceTable/index.js";
import LiquidationMenu from "./components/LiquidationMenu/index.js";
import Comptroller from "./CompoundProtocol/Comptroller.js";
import GasCosts from "./CompoundProtocol/GasCosts.js";
import OpenPriceFeed from "./CompoundProtocol/OpenPriceFeed.js";
import ERC20 from "./CompoundProtocol/ERC20.js";
import axios from "axios";
import Web3 from "web3";

// /home/robotito/Crypto/compound_liquidator/.env
//const result = require("dotenv").config({ path: "/home/robotito/Crypto/compound_liquidator/.env" });
//if (result.error) throw result.error;

//const web3 = new Web3("http://192.168.1.2:8545");
const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/v3/63bb2d03b65543a1bb50ed173d2c1966"));
const troll = new web3.eth.Contract(Comptroller.abi, Comptroller.address);
const priceFeed = new web3.eth.Contract(OpenPriceFeed.abi, OpenPriceFeed.address);


const gasURL = "https://ethgasstation.info/api/ethgasAPI.json?api-key=ba3b8b16c8236248538879ebba23562f288a4f93965d58d90b534b2ea44a";
const accountURL = "https://api.compound.finance/api/v2/account";
const cTokenURL = "https://api.compound.finance/api/v2/ctoken";
const accountRequestData = {
  max_health: { value: "1.0" },
  min_borrow_value_in_eth: { value: "0.002" },
  page_size: 100
};

function parseGasResponse(json) {
  console.log(JSON.stringify(json));
  console.log("SafeLow: " + json.data.safeLow);
  console.log("Average: " + json.data.average);
  console.log("Fast: " + json.data.fast);
  console.log("Fastest: " + json.data.fastest);

  return [json.data.safeLow / 10, json.data.average / 10, json.data.fast / 10, json.data.fastest / 10];
}

async function parsecTokenDataResponse(json) {
  try {
    const cTokenPromiseList = json.data.cToken.map(async cToken => {
      const tokenContract = new web3.eth.Contract(ERC20.abi, String(cToken.token_address));
      const tokenAllowance = await tokenContract.methods.allowance("0x47E01860F048c12449Bc31d1574566E7905A0880", String(cToken.token_address)).call();

      return {
        address: cToken.token_address,
        symbol: cToken.symbol,
        collateralFactor: cToken.collateral_factor.value,
        underlyingPriceInEth: cToken.underlying_price.value,
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
  let maxBorrowInEth = 0;

  const accountcTokenList = accountcTokens.map(token => {
    const underlyingPriceInEth = cTokenList.find(cToken => cToken.address === token.address).underlyingPriceInEth;
    const supply = token.supply_balance_underlying.value;
    const borrow = token.borrow_balance_underlying.value;

    const supplyInEth = supply * underlyingPriceInEth;
    const borrowInEth = borrow * underlyingPriceInEth;

    if (borrowInEth > maxBorrowInEth) maxBorrowInEth = borrowInEth;
    if (supplyInEth > maxSupplyInEth) maxSupplyInEth = supplyInEth;

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
    maxBorrowInEth: maxBorrowInEth,
    tokens: accountcTokenList
  }
}


function getProfitPerToken(tokens, app, maxSupplyInEth) {
  let maxProfitInEth = 0;
  const gasFees = (app.state.gasPrices[3] * GasCosts.liquidateBorrow) / 1e9;

  const profitPerTokenInEth = tokens.filter(token => token.borrow > 0).map(token => {
    let liquidableAmountInEth = token.supplyInEth * app.state.closeFactor;

    while (liquidableAmountInEth > maxSupplyInEth) liquidableAmountInEth -= 0.0001;

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
    let { maxSupplyInEth, maxBorrowInEth, tokens } = getTokens(account.tokens, cTokenList);
    let { maxProfitInEth, profitPerTokenInEth } = getProfitPerToken(tokens, app, maxSupplyInEth);

    return {
      address: account.address,
      health: account.health.value,
      borrowValueInEth: account.total_borrow_value_in_eth.value,
      collateralTimesFactorValueInEth: account.total_collateral_value_in_eth.value,
      tokens: tokens,
      profitPerTokenInEth: profitPerTokenInEth,
      maxSupplyInEth: maxSupplyInEth,
      maxBorrowInEth: maxBorrowInEth,
      maxProfitInEth: maxProfitInEth
    }
  });

  accountList.sort((a, b) => b.maxProfitInEth - a.maxProfitInEth);
  return accountList;
}

class App extends Component {
  constructor() {
    super();

    this.state = {
      displayTokens: false,

      addressToInspect: "",
      tokenToRepayAddress: "",
      tokenToCollectAddress: "",
      repayAmount: "",
      repayAMountInEth: "",
      profitInEth: "",

      ethToUsd: "",

      gasPrices: [],

      closeFactor: "",
      incentive: "",

      cTokens: [],
      accounts: []
    };

    this.refreshEthToUsd = this.refreshEthToUsd.bind(this);
    this.refreshCloseFactor = this.refreshCloseFactor.bind(this);
    this.refreshIncentive = this.refreshIncentive.bind(this);
    this.refreshGasPrices = this.refreshGasPrices.bind(this);
    this.refreshcTokenAndAccountList = this.refreshcTokenAndAccountList.bind(this);
  }

  componentDidMount() {
    this.refreshEthToUsd();
    this.refreshCloseFactor();
    this.refreshIncentive();
    this.refreshGasPrices();
    this.refreshcTokenAndAccountList();
  }

  async refreshEthToUsd() {
    try {
      let ethToUsd = await priceFeed.methods.getUnderlyingPrice("0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5").call() / 1e18;
      console.log(ethToUsd);

      this.setState({
        ethToUsd: ethToUsd
      })
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
      })
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
      })
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
      })
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

      this.setState({
        cTokens: cTokenList,
        accounts: accountList
      })

      console.log("Done refreshing cToken and account lists")
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
          <button onClick={() => this.setState({ displayTokens: true })}> See cTokens</button>
          <button style={{ float: "right" }} onClick={() => this.refreshcTokenAndAccountList()}> Refresh </button>
          <AccountsTable accounts={this.state.accounts} app={this} ethToUsd={this.state.ethToUsd} />
        </div>
      );
    } else {
      return (
        <div className="App">
          <button onClick={() => this.setState({ displayTokens: false })}> See accounts</button>
          <button style={{ float: "right" }} onClick={this.refreshTokenList}> Refresh </button>
          <TokensTable cTokens={this.state.cTokens} />
        </div>
      );
    }
  }
}
export default App;