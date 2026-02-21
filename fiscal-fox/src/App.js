/* global chrome */
import { useState, useEffect } from 'react';
import logo from './fawn-logo.png';
import bgImage from './BackgroundMain.jpg';
import './App.css';

const BANKING_DOMAINS = [
  'atb.com',
  'cibc.com',
  'td.com',
  'rbc.com',
  'scotiabank.com',
  'bmo.com',
  'tangerine.ca',
  'nationalbank.ca',
  'bnc.ca',
  'hsbc.ca',
  'simplii.com',
  'coastcapitalsavings.com',
  'meridiancu.ca',
  'easyweblogin.com',
  'online.atb.com',
  'mycibc.com',
  'rbcroyalbank.com',
];

function isBankingUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return BANKING_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

function App() {
  const [nightMode, setNightMode] = useState(false);
  const [isBankingSite, setIsBankingSite] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Send a message to content script to get current active night mode state
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;

      // Check if current tab is a banking site
      setIsBankingSite(isBankingUrl(tabs[0].url || ''));

      // Get night mode state and sidebar state from content script
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getState' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response) setNightMode(response.nightMode);
      });

      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSummarizeState' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response) setSidebarOpen(response.sidebarOpen);
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

  const toggleSummarize = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleSummarize' });
      window.close();
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
          <button
            className={`action-btn${sidebarOpen ? ' active' : ''}`}
            onClick={toggleSummarize}
            disabled={!isBankingSite}
            title={isBankingSite ? (sidebarOpen ? 'Close summary' : 'Summarize your transactions') : 'Visit a banking website to use this feature'}
          >
            Summarize Screen
          </button>
        </div>
        {!isBankingSite && (
          <p className="bank-hint">Visit your banking website to enable transaction summaries.</p>
        )}

        <button
          className="settings-btn"
          title="Settings"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          Settings
        </button>
      </header>
    </div>
  );
}

export default App;
