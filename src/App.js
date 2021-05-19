import React, { Component } from 'react';
import AccountsTable from './components/AccountsTable/index.js';
import TokensTable from './components/TokensTable/index.js';
import Comptroller from './CompoundProtocol/Comptroller.js';
import GasCosts from './CompoundProtocol/GasCosts.js';
import axios from 'axios';
import Web3 from 'web3';

const web3 = new Web3('http://192.168.1.2:8545');
const troll = new web3.eth.Contract(Comptroller.abi, Comptroller.address);


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
        profit: token.supply_balance_underlying.value * app.closeFactor * (app.incentive - 1)
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
  props.app.refreshCloseFactor();
  props.app.refreshIncentive();
  props.app.refreshGasPrice();
  props.app.refreshEthToUsd();
  props.app.refreshTokenList();
  props.app.refreshAccountsList();
  return (<div />);
}

class App extends Component {
  static closeFactor;
  static incentive;
  static gasPrice;
  static ethToUsd;

  constructor() {
    super();

    this.state = {
      accounts: [],
      cTokens: []
    };
  }

  async refreshEthToUsd() {
    this.ethToUsd = 3000;
  }

  async refreshCloseFactor() {
    //this.closeFactor = 0.5;

    try {
      this.closeFactor = await troll.methods.closeFactorMantissa().call() / 1e18;
    } catch (error) {
      console.error(error);
    }

  }

  async refreshIncentive() {
    //this.incentive = 1.08;

    try {
      this.incentive = await troll.methods.liquidationIncentiveMantissa().call() / 1e18;
    } catch (error) {
      console.error(error);
    }

  }

  async refreshGasPrice() {
    //this.gasPrice = 182e9;

    try {
      this.gasPrice = await web3.eth.getGasPrice();
    } catch (error) {
      console.error(error);
    }

  }

  refreshTokenList() {
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

  refreshAccountsList() {
    let URL = 'https://api.compound.finance/api/v2/account';

    axios({
      method: 'POST',
      url: URL,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },

      data: {
        max_health: { value: '2.0' },
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
      console.log(this.ethToUsd);
      let liquidationFee = this.gasPrice * GasCosts.liquidateBorrow;
      return (
        <div className='App'>
          <h3> Liquidation Fee  </h3>
          <span> {liquidationFee} WEI, </span>
          <span> {liquidationFee / 1e9} GWEI, </span>
          <span> {liquidationFee / 1e18} ETH, </span>
          <span> {(liquidationFee / 1e18) * this.ethToUsd} USD </span>
          <button style={{ float: 'right' }} onClick={this.refreshAccountsList}> Refresh </button>
          <AccountsTable accounts={this.state.accounts} ethToUsd={this.ethToUsd} />
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