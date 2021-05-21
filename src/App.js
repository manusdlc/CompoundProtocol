import React, { Component } from 'react';
import AccountsTable from './components/AccountsTable/index.js';
import TokensTable from './components/TokensTable/index.js';
import Comptroller from './CompoundProtocol/Comptroller.js';
import GasCosts from './CompoundProtocol/GasCosts.js';
import OpenPriceFeed from './CompoundProtocol/OpenPriceFeed.js';
import axios from 'axios';
import Web3 from 'web3';

const web3 = new Web3('http://192.168.1.2:8545');
const troll = new web3.eth.Contract(Comptroller.abi, Comptroller.address);
const priceFeed = new web3.eth.Contract(OpenPriceFeed.abi, OpenPriceFeed.address);


function parsecTokenDataResponse(json, app) {
  let cTokensList = json.cToken.map(cToken => {
    return {
      address: cToken.token_address,
      symbol: cToken.symbol,
      collateralFactor: cToken.collateral_factor.value,
      underlyingPriceInEth: cToken.underlying_price.value
    };
  });

  app.setState({
    cTokens: cTokensList
  })
}

function parseAccountDataResponse(json, app) {
  let accountsList = json.accounts.map(account => {
    let tokens = account.tokens.map(token => {
      return {
        address: token.address,
        symbol: token.symbol,
        supply: token.supply_balance_underlying.value,
        borrow: token.borrow_balance_underlying.value,
        profit: token.supply_balance_underlying.value * app.state.closeFactor * (app.state.incentive - 1)
      }
    }
    );

    let maxProfit = 0;
    let profitPerTokenInEth = tokens.filter(token => token.supply > 0).map(token => {
      let underlyingPriceInEth = 0;

      app.state.cTokens.forEach(cToken => {
        if (token.address === cToken.address) underlyingPriceInEth = cToken.underlyingPriceInEth;
      })

      let profitInEth = underlyingPriceInEth * token.profit;
      if (profitInEth > maxProfit) maxProfit = profitInEth;

      return {
        address: token.address,
        symbol: token.symbol,
        profitInEth: profitInEth,
      }
    });


    return {
      address: account.address,
      health: account.health.value,
      borrowValueInEth: account.total_borrow_value_in_eth.value,
      collateralTimesFactorValueInEth: account.total_collateral_value_in_eth.value,
      tokens: tokens,
      profitPerTokenInEth: profitPerTokenInEth,
      maxProfit: maxProfit
    }
  });

  accountsList.sort((a, b) => {
    return b.maxProfit - a.maxProfit;
  })

  app.setState({
    accounts: accountsList
  })
}


function Loader(props) {
  props.app.refreshAccountList();
  return (<div />);
}

class App extends Component {

  constructor() {
    super();

    this.refreshEthToUsd = this.refreshEthToUsd.bind(this);
    this.refreshCloseFactor = this.refreshCloseFactor.bind(this);
    this.refreshIncentive = this.refreshIncentive.bind(this);
    this.refreshGasPrice = this.refreshGasPrice.bind(this);
    this.refreshAccountList = this.refreshAccountList.bind(this);
    this.refreshTokenList = this.refreshTokenList.bind(this);

    this.state = {
      ethToUsd: '',
      closeFactor: '',
      incentive: '',
      gasPrice: '',
      accounts: [],
      cTokens: []
    };
  }

  componentDidMount() {
    this.refreshEthToUsd();
    this.refreshCloseFactor();
    this.refreshIncentive();
    this.refreshGasPrice();
    this.refreshTokenList();
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

  async refreshGasPrice() {
    //this.gasPrice = 182e9;

    try {
      let gasPrice = await web3.eth.getGasPrice();
      console.log(gasPrice);

      this.setState({
        gasPrice: gasPrice
      })
    } catch (error) {
      console.error(error);
    }

  }

  async refreshTokenList() {
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
        page_size: 100,
      }

    }).then(response => {
      parseAccountDataResponse(response.data, this);
    }).catch(error => {
      console.error(error);
    });
  }

  render() {
    if (this.state.accounts.length === 0) {
      return (
        <div>
          <Loader app={this}> Loading ... </Loader>
        </div>
      );
    }

    if (true) {
      let liquidationFee = this.state.gasPrice * GasCosts.liquidateBorrow;
      return (
        <div className='App'>
          <button style={{ float: 'right' }} onClick={this.refreshEthToUsd}> Refresh </button>
          <h3> ETH - USD  </h3>
          <span> {this.state.ethToUsd} USD </span>
          <button style={{ float: 'right' }} onClick={this.refreshGasPrice}> Refresh </button>
          <h3> Gas Price  </h3>
          <span> {this.state.gasPrice} WEI </span>
          <h3> Liquidation Fee  </h3>
          <span> {liquidationFee} WEI, </span>
          <span> {liquidationFee / 1e9} GWEI, </span>
          <span> {liquidationFee / 1e18} ETH, </span>
          <span> {(liquidationFee / 1e18) * this.state.ethToUsd} USD </span>
          <button style={{ float: 'right' }} onClick={this.refreshAccountList}> Refresh </button>
          <AccountsTable accounts={this.state.accounts} ethToUsd={this.state.ethToUsd} />
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