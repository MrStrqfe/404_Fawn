/* global chrome */
import { useState, useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";

function App() {
  const [nightMode, setNightMode] = useState(false);
  const [keyword, setKeyword] = useState("");

  // Sync night mode state when the popup opens
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "getState" },
        (response) => {
          if (chrome.runtime.lastError) return;
          if (response) setNightMode(response.nightMode);
        },
      );
    });
  }, []);

  const toggleNightMode = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "toggleNightMode" },
        (response) => {
          if (chrome.runtime.lastError) return;
          if (response) setNightMode(response.nightMode);
        },
      );
    });
  };

  // NEW: Function to trigger the keyword search on the page
  const handleSearch = () => {
    if (!keyword.trim()) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "SEARCH_KEYWORD",
        keyword: keyword,
      });
    });
  };

  // NEW: Function to stop all reading
  const stopReading = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_SPEECH" });
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="top-nav">
          <button onClick={toggleNightMode} title="Toggle Night Mode">
            {nightMode ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            title="Settings"
          >
            ⚙️
          </button>
        </div>

        <img src={logo} className="App-logo" alt="logo" />

        {/* --- NEW ACCESSIBILITY SECTION --- */}
        <div className="search-section">
          <input
            type="text"
            placeholder="Search for a keyword..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="search-input"
          />
          <div className="button-group">
            <button onClick={handleSearch} className="read-btn">
              🔊 Read Paragraph
            </button>
            <button onClick={stopReading} className="stop-btn">
              🛑 Stop
            </button>
          </div>
        </div>
        {/* --------------------------------- */}

        <p>Fiscal Fox Accessibility Helper</p>
      </header>
    </div>
  );
}

export default App;
