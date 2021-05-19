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
  let cTokensList = [];

  json.cToken.forEach(cToken => {
    let newcToken = {
      address: cToken.token_address,
      symbol: cToken.symbol,
      collateralFactor: cToken.collateral_factor.value,
      underlyingPriceInEth: cToken.underlying_price.value
    };

    cTokensList.push(newcToken);
  });

  app.setState({
    cTokens: cTokensList
  })
}

function parseAccountDataResponse(json, app) {
  let accountsList = [];

  json.accounts.forEach(account => {
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

    let profitPerTokenInEth = tokens.filter(token => token.supply > 0).map(token => {
      let underlyingPriceInEth = 1;
      app.state.cTokens.forEach(cToken => {
        if (token.address === cToken.address) underlyingPriceInEth = cToken.underlyingPriceInEth;
      })
      return {
        address: token.address,
        symbol: token.symbol,
        profitInEth: underlyingPriceInEth * token.profit
      }
    });

    let newAccount = {
      address: account.address,
      health: account.health.value,
      borrowValueInEth: account.total_borrow_value_in_eth.value,
      collateralTimesFactorValueInEth: account.total_collateral_value_in_eth.value,
      tokens: tokens,
      profitPerTokenInEth: profitPerTokenInEth
    }

    accountsList.push(newAccount);
  });

  app.setState({
    accounts: accountsList
  })
}


function Loader(props) {
  props.app.refreshCloseFactor();
  props.app.refreshIncentive();
  props.app.refreshGasPrice();
  props.app.requestTokenList();
  props.app.refreshAccountsList();
  return (<div />);
}

class App extends Component {
  constructor() {
    super();

    let closeFactor;
    let incentive;
    let gasPrice;

    this.state = {
      accounts: [],
      cTokens: []
    };
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
      console.log(this.gasPrice);
    } catch (error) {
      console.error(error);
    }

  }

  requestTokenList() {
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
      let liquidationFee = this.gasPrice * GasCosts.liquidateBorrow;
      return (
        <div className='App'>
          <h3> Liquidation Fee  </h3>
          <span> {liquidationFee} wei, </span>
          <span> {liquidationFee / 1e9} gwei, </span>
          <span> {liquidationFee / 1e18} eth, </span>
          <span> {liquidationFee / 1e18 * 4398} usd </span>
          <button style={{ float: 'right' }} onClick={this.refreshAccountsList}> Refresh </button>
          <AccountsTable accounts={this.state.accounts} />
        </div>
      );
    }

    if (true) {
      return (
        <div className='App'>
          <button style={{ float: 'right' }} onClick={this.requestTokenList}> Refresh </button>
          <TokensTable cTokens={this.state.cTokens} />
        </div>
      );
    }
  }
}
export default App;