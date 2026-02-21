/* global chrome, browser */
import { useState, useEffect } from "react";
import "./App.css";

const ext = typeof browser !== "undefined" ? browser : chrome;

function App() {
  const [nightMode, setNightMode] = useState(false);
  const [keyword, setKeyword] = useState("");

  // helper: send message to active tab
  const sendToActiveTab = (message, callback) => {
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;

      ext.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (ext.runtime.lastError) return;
        if (callback) callback(response);
      });
    });
  };

  // sync state on popup open
  useEffect(() => {
    sendToActiveTab({ action: "getState" }, (response) => {
      if (response?.nightMode !== undefined) {
        setNightMode(response.nightMode);
      }
    });
  }, []);

  // toggle night mode
  const toggleNightMode = () => {
    sendToActiveTab({ action: "toggleNightMode" }, (response) => {
      if (response?.nightMode !== undefined) {
        setNightMode(response.nightMode);
      }
    });
  };

  // trigger keyword read
  const handleSearch = () => {
    if (!keyword.trim()) return;

    sendToActiveTab({
      action: "SEARCH_KEYWORD",
      keyword: keyword.trim(),
    });
  };

  // stop speech
  const stopReading = () => {
    sendToActiveTab({ action: "STOP_SPEECH" });
  };

  return (
    <div className="App">
      <header className="App-header">
        {/* Top controls */}
        <div className="top-nav">
          <button onClick={toggleNightMode} title="Toggle Night Mode">
            {nightMode ? "☀️" : "🌙"}
          </button>

          <button
            onClick={() => ext.runtime.openOptionsPage()}
            title="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Accessibility Section */}
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
      </header>
    </div>
  );
}

export default App;
