/* global chrome */
import { useState } from 'react';
import logo from './logo.svg';
import './App.css';

function App() {
  const [nightMode, setNightMode] = useState(false);

  const toggleNightMode = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleNightMode' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response) setNightMode(response.nightMode);
      });
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <button
          className="night-mode-btn"
          onClick={toggleNightMode}
          title={nightMode ? 'Switch to light mode' : 'Switch to night mode'}
        >
          {nightMode ? '☀️' : '🌙'}
        </button>
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
