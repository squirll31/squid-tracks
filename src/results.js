import React from 'react';
import {
  Grid,
  Row,
  Col,
  ButtonToolbar,
  ButtonGroup,
  Button,
  DropdownButton,
  MenuItem,
  Glyphicon
} from 'react-bootstrap';
import ResultsSummaryCard from './components/results-summary-card';
import ResultsCard from './components/results-card';
import ResultDetailCard from './components/result-detail-card';
const { ipcRenderer } = window.require('electron');

const Results = () =>
  <Grid fluid style={{ marginTop: 65 }}>
    <Row>
      <Col md={12}>
        <ResultsContainer />
      </Col>
    </Row>
  </Grid>;

class ResultsPoller extends React.Component {
  state = {
    active: false,
    lastBattleUploaded: 0,
    activeText: 'Not Polling'
  };

  start = () => {
    this.setState({ active: true, activeText: 'Waiting for Battle Data' });
    this.poll(true);
  };

  stop = () => {
    this.setState({ active: false });
  };

  poll = start => {
    if (!this.state.active && !start) {
      return;
    }
    this.props.getResults();
    setTimeout(this.poll, 60000); // 2 minutes
  };

  handleClick = () => {
    if (this.state.active) {
      this.stop();
    } else {
      this.start();
    }
  };

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.active &&
      this.props.result.battle_number &&
      this.props.result.battle_number > prevProps.result.battle_number
    ) {
      this.setState({
        activeText: `writing battle ${this.props.result.battle_number}`
      });
      const info = ipcRenderer.sendSync('writeToStatInk', this.props.result);
      if (info.username) {
        this.props.setStatInkInfo(this.props.result.battle_number, info);
      }
      this.setState({
        activeText: `Wrote battle ${this.props.result.battle_number}`
      });
      setTimeout(() => {
        this.setState({ activeText: `Waiting for Battle Data` });
      }, 10000);
    }
  }

  render() {
    return (
      <Button
        onClick={this.handleClick}
        active={this.state.active}
        disabled={this.props.disabled}
      >
        {this.state.active ? this.state.activeText : 'Auto-upload to stat.ink'}
      </Button>
    );
  }
}

class ResultControl extends React.Component {
  state = {
    tokenExists: false,
    refreshing: false,
    wroteToStatInk: false
  };

  componentDidMount() {
    const token = ipcRenderer.sendSync('getStatInkApiToken');
    this.setState({ tokenExists: token.length > 0 });
  }

  render() {
    const {
      latestBattleNumber,
      result,
      changeResult,
      getResults,
      results,
      setStatInkInfo
    } = this.props;

    const currentBattle = result.battle_number ? result.battle_number : 0;

    return (
      <ButtonToolbar style={{ marginBottom: 10 }}>
        <Button
          onClick={() => {
            getResults();
            this.setState({ refreshing: true });
            setTimeout(() => this.setState({ refreshing: false }), 2000);
          }}
          disabled={this.state.refreshing}
        >
          {this.state.refreshing ? 'Refreshed' : 'Refresh'}
        </Button>
        <ButtonGroup>
          <Button
            onClick={() => changeResult(currentBattle - 1)}
            disabled={currentBattle === latestBattleNumber + 50}
          >
            <Glyphicon glyph="triangle-left" />
          </Button>
          <DropdownButton title={currentBattle} id={'battles'}>
            {results.map(result =>
              <MenuItem
                key={result.battle_number}
                onClick={() => changeResult(result.battle_number)}
              >
                {result.battle_number}
              </MenuItem>
            )}
          </DropdownButton>
          <Button
            onClick={() => changeResult(parseInt(currentBattle, 10) + 1)}
            disabled={currentBattle === latestBattleNumber}
          >
            <Glyphicon glyph="triangle-right" />
          </Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button
            onClick={() => {
              const info = ipcRenderer.sendSync('writeToStatInk', result);
              if (info.username) {
                setStatInkInfo(currentBattle, info);
              }
              this.setState({ wroteToStatInk: true });
              setTimeout(() => this.setState({ wroteToStatInk: false }), 2000);
            }}
            disabled={!this.state.tokenExists || this.state.wroteToStatInk}
          >
            {this.state.wroteToStatInk ? 'Uploaded' : 'Upload to stat.ink'}
          </Button>
        </ButtonGroup>
        <ResultsPoller
          getResults={getResults}
          result={result}
          disabled={!this.state.tokenExists}
          setStatInkInfo={setStatInkInfo}
        />
      </ButtonToolbar>
    );
  }
}

class ResultsContainer extends React.Component {
  state = {
    results: {
      summary: {},
      results: []
    },
    currentResult: {},
    statInk: {}
  };

  componentDidMount() {
    this.getResults();
    const statInkInfo = ipcRenderer.sendSync('getFromStore', 'statInkInfo');
    this.setState({ statInk: statInkInfo });
  }

  getResults = () => {
    const results = ipcRenderer.sendSync('getApi', 'results');
    this.setState({ results: results });
    this.changeResult(results.results[0].battle_number);
    this.setState({ initialized: true });
  };

  changeResult = battleNumber => {
    this.setState({
      currentResult: ipcRenderer.sendSync('getApi', `results/${battleNumber}`)
    });
  };

  setStatInkInfo = (battleNumber, info) => {
    const statInk = this.state.statInk;
    statInk[battleNumber] = info;
    this.setState({ statInk: statInk });
    ipcRenderer.sendSync('setToStore', 'statInkInfo', statInk);
  };

  render() {
    return (
      <div>
        <ResultControl
          latestBattleNumber={
            this.state.results.results[0]
              ? this.state.results.results[0].battle_number
              : 0
          }
          result={this.state.currentResult}
          results={this.state.results.results}
          changeResult={this.changeResult}
          getResults={this.getResults}
          setStatInkInfo={this.setStatInkInfo}
        />
        {this.state.initialized
          ? <ResultDetailCard
              result={this.state.currentResult}
              statInk={this.state.statInk}
            />
          : null}
        <ResultsSummaryCard summary={this.state.results.summary} />
        <ResultsCard
          results={this.state.results.results}
          changeResult={this.changeResult}
        />
      </div>
    );
  }
}

export default Results;
