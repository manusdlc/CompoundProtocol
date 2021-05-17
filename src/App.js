import React, { Component } from 'react';
import AccountsTable from './components/AccountsTable/index.js';
import TokensTable from './components/TokensTable/index.js';
import Comptroller from './CompoundProtocol/comptroller.js'
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
    let newAccount = {
      address: account.address,
      health: account.health.value * 1,
      borrowValueInEth: account.total_borrow_value_in_eth.value * 1,
      collateralTimesFactorValueInEth: account.total_collateral_value_in_eth.value * 1,
      tokens: account.tokens,
      profitNoTxFees: (account.total_borrow_value_in_eth.value * app.closeFactor * app.incentive)
        - (account.total_borrow_value_in_eth.value * app.closeFactor)
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
  props.app.requestTokenList();
  props.app.refreshAccountsList();
  return (<div />);
}

class App extends Component {
  constructor() {
    super();

    let closeFactor;
    let incentive;

    this.state = {
      accounts: [],
      cTokens: []
    };
  }

  async refreshCloseFactor() {
    this.closeFactor = await troll.methods.closeFactorMantissa().call() / 1e18;
  }

  async refreshIncentive() {
    this.incentive = await troll.methods.liquidationIncentiveMantissa().call() / 1e18;
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
        min_borrow_value_in_eth: { value: '.002' },
        page_size: 100,
      }

    }).then(response => {
      parseAccountDataResponse(response.data, this);
    }).catch(error => {
      console.error(error);
    });
  }

  componentDidMount() { }

  render() {
    if (this.state.accounts.length === 0) {
      return (
        <div>
          <Loader app={this}> Loading ... </Loader>
        </div>
      );
    }

    if (true) {
      return (
        <div className='App'>
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