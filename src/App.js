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

//Load environment variables
require("custom-env").config("dev", "/home/robotito/Crypto/compound_liquidator/.env");
console.log("TESTING " + process.env.INFURA_API);

//const web3 = new Web3(process.env.GETH_IP);
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.INFURA_API));
const troll = new web3.eth.Contract(Comptroller.abi, Comptroller.address);
const priceFeed = new web3.eth.Contract(OpenPriceFeed.abi, OpenPriceFeed.address);

const gasURL = process.env.ETHER_SCAN_API;
const accountURL = "https://api.compound.finance/api/v2/account";
const cTokenURL = "https://api.compound.finance/api/v2/ctoken";
const accountRequestData = {
  max_health: { value: "1.0" },
  min_borrow_value_in_eth: { value: "0.002" },
  page_size: 100
};

function parseGasResponse(json) {
  console.log("Safe: " + json.data.result.SafeGasPrice);
  console.log("Propose: " + json.data.result.ProposeGasPrice);
  console.log("Fast: " + json.data.result.FastGasPrice);

  return [json.data.result.SafeGasPrice * 1e9, json.data.result.ProposeGasPrice * 1e9, json.data.result.FastGasPrice * 1e9];
}

async function parsecTokenDataResponse(json) {
  try {
    const cTokenPromiseList = json.data.cToken.map(async cToken => {
      const tokenContract = new web3.eth.Contract(ERC20.abi, String(cToken.token_address));
      const tokenAllowance = await tokenContract.methods.allowance(process.env.MY_ACCOUNT_ADDRESS, String(cToken.token_address)).call();

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
  const gasFees = (app.state.gasPrices[1] * GasCosts.liquidateBorrow) / 1e18;

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

  accountList.sort((a, b) => {
    return b.maxProfitInEth - a.maxProfitInEth;
  });

  return accountList;
}

class App extends Component {
  constructor() {
    super();

    this.state = {
      displayTokens: false,

      addressToInspect: "",
      tokenToRepay: "",
      tokenToCollect: "",
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
    //parsing account data requires data from the cToken list
    try {
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
      if (this.state.tokenToRepay.length > 0 && this.state.tokenToCollect.length > 0) {
        return (
          <div className="App">
            <BalanceTable app={this} address={this.state.addressToInspect}></BalanceTable>
            <LiquidationMenu app={this} accountAddress={this.state.addressToInspect}
              tokenToRepay={this.state.tokenToRepay} tokenToCollect={this.state.tokenToCollect}></LiquidationMenu>
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