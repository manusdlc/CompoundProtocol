import React, { Component } from 'react';
import AccountsTable from './components/AccountsTable/index.js';
import TokensTable from './components/TokensTable/index.js';
import Comptroller from './CompoundProtocol/Comptroller.js';
import GasCosts from './CompoundProtocol/GasCosts.js';
import OpenPriceFeed from './CompoundProtocol/OpenPriceFeed.js';
import axios from 'axios';
import Web3 from 'web3';
import BalanceTable from './components/BalanceTable/index.js';

const web3 = new Web3('http://192.168.1.2:8545');
const troll = new web3.eth.Contract(Comptroller.abi, Comptroller.address);
const priceFeed = new web3.eth.Contract(OpenPriceFeed.abi, OpenPriceFeed.address);

function parseGasPricesResponse(json, app) {
  console.log("Safe: " + json.data.result.SafeGasPrice);
  console.log("Propose: " + json.data.result.ProposeGasPrice);
  console.log("Fast: " + json.data.result.FastGasPrice);

  app.setState({
    gasPrices: [json.data.result.SafeGasPrice * 1e9, json.data.result.ProposeGasPrice * 1e9, json.data.result.FastGasPrice * 1e9]
  });
}

function parsecTokenDataResponse(json, app) {
  let cTokenList = json.cToken.map(cToken => {
    return {
      address: cToken.token_address,
      symbol: cToken.symbol,
      collateralFactor: cToken.collateral_factor.value,
      underlyingPriceInEth: cToken.underlying_price.value
    };
  });

  app.setState({
    cTokens: cTokenList
  });
}

function getUnderlyingPriceInEth(token, app) {
  return app.state.cTokens.find(cToken => cToken.address === token.address).underlyingPriceInEth;
}

function getTokens(tokens, app) {
  let maxSupplyInEth = 0;
  let maxBorrowInEth = 0;

  let tokenList = tokens.map(token => {
    let underlyingPriceInEth = getUnderlyingPriceInEth(token, app);
    let supply = token.supply_balance_underlying.value;
    let borrow = token.borrow_balance_underlying.value;

    let supplyInEth = supply * underlyingPriceInEth;
    let borrowInEth = borrow * underlyingPriceInEth;

    if (borrowInEth > maxBorrowInEth) maxBorrowInEth = borrowInEth;
    if (supplyInEth > maxSupplyInEth) maxSupplyInEth = supplyInEth;

    return {
      address: token.address,
      symbol: token.symbol,
      supply: supply,
      supplyInEth: supplyInEth,
      borrow: borrow,
      borrowInEth: borrowInEth,
      underlyingPriceInEth: underlyingPriceInEth,
      profit: token.borrow_balance_underlying.value * app.state.closeFactor * (app.state.incentive - 1)
    }
  });

  return {
    maxSupplyInEth: maxSupplyInEth,
    tokens: tokenList
  }
}


function getProfitPerToken(tokens, app, maxSupplyInEth) {
  let maxProfitInEth = 0;

  let profitPerTokenInEth = tokens.filter(token => token.borrow > 0).map(token => {
    let liquidableAmountInEth = token.supplyInEth * app.state.closeFactor;

    while (liquidableAmountInEth > maxSupplyInEth) liquidableAmountInEth -= 0.0001;

    let profitInEth = liquidableAmountInEth * (app.state.incentive - 1);
    if (profitInEth > maxProfitInEth) maxProfitInEth = profitInEth;

    let profitMinusTxFees = profitInEth - (app.state.gasPrices[1] * GasCosts.liquidateBorrow) / 1e18;

    return {
      address: token.address,
      symbol: token.symbol,
      profitInEth: profitInEth,
      profitMinusTxFees: profitMinusTxFees
    }
  });

  return {
    maxProfitInEth: maxProfitInEth,
    profitPerTokenInEth: profitPerTokenInEth
  }
}

function parseAccountDataResponse(json, app) {
  let accountList = json.accounts.map(account => {
    let { maxSupplyInEth, tokens } = getTokens(account.tokens, app);
    let { maxProfitInEth, profitPerTokenInEth } = getProfitPerToken(tokens, app, maxSupplyInEth);


    return {
      address: account.address,
      health: account.health.value,
      borrowValueInEth: account.total_borrow_value_in_eth.value,
      collateralTimesFactorValueInEth: account.total_collateral_value_in_eth.value,
      tokens: tokens,
      profitPerTokenInEth: profitPerTokenInEth,
      maxSupplyInEth: maxSupplyInEth,
      maxProfitInEth: maxProfitInEth
    }
  });

  accountList.sort((a, b) => {
    return b.maxProfitInEth - a.maxProfitInEth;
  });

  app.setState({
    accounts: accountList
  });
}

class App extends Component {
  constructor() {
    super();

    this.initialized = false;

    this.state = {
      inspectingAddress: false,
      addressToInspect: '',
      ethToUsd: '',
      closeFactor: '',
      incentive: '',
      gasPrices: [],
      accounts: [],
      cTokens: []
    };

    this.refreshEthToUsd = this.refreshEthToUsd.bind(this);
    this.refreshCloseFactor = this.refreshCloseFactor.bind(this);
    this.refreshIncentive = this.refreshIncentive.bind(this);
    this.refreshGasPrices = this.refreshGasPrices.bind(this);
    this.refreshAccountList = this.refreshAccountList.bind(this);
    this.refreshTokenList = this.refreshTokenList.bind(this);
  }

  componentDidMount() {
    this.refreshEthToUsd();
    this.refreshCloseFactor();
    this.refreshIncentive();
    this.refreshGasPrices();
  }

  async refreshEthToUsd() {
    //this.ethToUsd = 3000;

    try {
      let ethToUsd = await priceFeed.methods.getUnderlyingPrice('0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5').call() / 1e18;
      console.log(ethToUsd);

      this.setState({
        ethToUsd: ethToUsd
      })
    } catch (error) {
      console.error(error);
    }
  }

  async refreshCloseFactor() {
    //this.closeFactor = 0.5;

    try {
      let closeFactor = await troll.methods.closeFactorMantissa().call() / 1e18;
      console.log(closeFactor);

      this.setState({
        closeFactor: closeFactor
      })
    } catch (error) {
      console.error(error);
    }

  }

  async refreshIncentive() {
    //this.incentive = 1.08;

    try {
      let incentive = await troll.methods.liquidationIncentiveMantissa().call() / 1e18;
      console.log(incentive);

      this.setState({
        incentive: incentive
      })
    } catch (error) {
      console.error(error);
    }

  }

  async refreshGasPrices() {
    //this.gasPrice = 182e9;

    /*try {
      let gasPrice = await web3.eth.getGasPrice();
      console.log(gasPrice);

      this.setState({
        gasPrice: gasPrice
      })
    } catch (error) {
      console.error(error);
    }*/

    let URL = 'https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=KHN6I9RRKD817BHIQTWENYKSP8IR49XMTF';

    axios({
      method: 'GET',
      url: URL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        parseGasPricesResponse(response, this);
      })
      .catch(error => {
        console.error(error);
      });
  }

  async refreshTokenList() {
    console.log('Refreshing cToken List');

    let URL = 'https://api.compound.finance/api/v2/ctoken';

    axios({
      method: 'POST',
      url: URL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        parsecTokenDataResponse(response.data, this);
      })
      .catch(error => {
        console.error(error);
      });
  }

  async refreshAccountList() {
    //Refresh cTokenList first
    await this.refreshTokenList();

    console.log('Refreshing Account List');

    let URL = 'https://api.compound.finance/api/v2/account';

    axios({
      method: 'POST',
      url: URL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },

      data: {
        max_health: { value: '1.0' },
        min_borrow_value_in_eth: { value: '0.002' },
        page_size: 100
      }

    }).then(response => {
      parseAccountDataResponse(response.data, this);
    }).catch(error => {
      console.error(error);
    });
  }

  render() {
    if (!this.initialized) {
      this.initialized = true;
      this.refreshAccountList();
      return (<div />);
    }

    if (this.state.inspectingAddress) {
      return (
        <BalanceTable app={this} address={this.state.addressToInspect}></BalanceTable>
      );
    }

    if (true) {
      let liquidationFee = this.state.gasPrices[1] * GasCosts.liquidateBorrow;
      return (
        <div className='App'>
          <button style={{ float: 'right' }} onClick={this.refreshEthToUsd}> Refresh </button>
          <h3> ETH - USD  </h3>
          <span> {this.state.ethToUsd} USD </span>
          <button style={{ float: 'right' }} onClick={this.refreshGasPrices}> Refresh </button>
          <h3> Gas Price (GWEI) </h3>
          <span> Safe: {this.state.gasPrices[0] / 1e9}, Propose: {this.state.gasPrices[1] / 1e9}, Fast: {this.state.gasPrices[2] / 1e9}  </span>
          <h3> Liquidation Fee  </h3>
          <span> {liquidationFee} WEI, </span>
          <span> {liquidationFee / 1e9} GWEI, </span>
          <span> {liquidationFee / 1e18} ETH, </span>
          <span> {(liquidationFee / 1e18) * this.state.ethToUsd} USD </span>
          <button style={{ float: 'right' }} onClick={this.refreshAccountList}> Refresh </button>
          <AccountsTable accounts={this.state.accounts} app={this} ethToUsd={this.state.ethToUsd} />
        </div>
      );
    }

    if (true) {
      return (
        <div className='App'>
          <button style={{ float: 'right' }} onClick={this.refreshTokenList}> Refresh </button>
          <TokensTable cTokens={this.state.cTokens} />
        </div>
      );
    }
  }
}
export default App;