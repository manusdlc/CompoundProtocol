import React, { Component } from 'react';
import AccountsTable from './components/AccountsTable/index.js';
import axios from 'axios';

function parseAccountDataResponse(json, app) {
  let newAccounts = [];

  json.accounts.forEach(account => {
    let newAccount = {
      address: account.address,
      health: (account.health.value * 1).toFixed(6),
      borrowValueInEth: (account.total_borrow_value_in_eth.value * 1).toFixed(6),
      collateralTimesFactorValueInEth: (account.total_collateral_value_in_eth.value * 1).toFixed(6),
      tokens: account.tokens
    }

    newAccounts.push(newAccount);
  });

  app.setState({
    accounts: newAccounts
  })
}

function Loader(props) {
  props.app.refreshAccountsList();
  return (<div />);
}

class App extends Component {
  constructor() {
    super();

    this.state = {
      accounts: []
    };
  }

  refreshAccountsList() {
    let URL = 'https://api.compound.finance/api/v2/account';

    axios({
      method: 'POST',
      url: URL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },

      data: {
        max_health: { value: '2.0' },
        min_borrow_value_in_eth: { value: '.002' },
        page_size: 100,
      }

    }).then(response => {
      parseAccountDataResponse(response.data, this);
    })
      .catch(error => {
        console.error(error)
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
    } else {
      return (
        <div className='App'>
          <button style={{float: 'right'}} onClick={this.refreshAccountsList}> Refresh </button>
          <AccountsTable accounts={this.state.accounts} />
        </div>
      );
    }
  }
}
export default App;