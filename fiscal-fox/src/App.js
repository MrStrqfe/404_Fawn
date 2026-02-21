/* global chrome */
import { useState, useEffect } from 'react';
import logo from './fawn-logo.png';
import bgImage from './BackgroundMain.jpg';
import './App.css';

function App() {
  const [nightMode, setNightMode] = useState(false);

  useEffect(() => {
    // Send a message to content script to get current active night mode state
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getState' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response) setNightMode(response.nightMode);
      });
    });
  }, []);

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
    <div className="App" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <header className="App-header">
        <button
          className="night-mode-btn"
          onClick={toggleNightMode}
          title={nightMode ? 'Switch to light mode' : 'Switch to night mode'}
        >
          {nightMode ? '☀️' : '🌙'}
        </button>

        <img src={logo} className="App-logo" alt="logo" />
        <h1 className="app-title">Fawn</h1>

        <div className="action-buttons">
          <button className="action-btn" onClick={() => chrome.tabs.create({ url: 'remote-access.html' })}>Remote Access</button>
          <button className="action-btn">Summarize Screen</button>
        </div>

        <button
          className="settings-btn"
          title="Settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          ⚙️ Settings
        </button>
      </header>
    </div>
  );
}

export default App;
