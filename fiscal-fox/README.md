# Fawn

A Chrome extension that makes online banking accessible for everyone. Built for older adults, people with visual impairments, dyslexia, and anyone who finds financial websites overwhelming.

## What It Does

**Fawn** sits in your browser and adds accessibility features to any banking website:

- **Transaction Summary** -- Automatically reads your banking page and organizes transactions into categories (Groceries, Dining, Utilities, etc.) with spending totals in a clean sidebar.
- **Night Mode** -- Reduces eye strain with a dark mode filter that works on any website.
- **Colour Blind Filters** -- Preset filters for Deuteranopia, Protanopia, Tritanopia, and Monochromacy, plus custom RGB sliders.
- **Dyslexic Reading Mode** -- Applies the OpenDyslexic font across the page for improved readability.
- **Financial Term Definitions** -- Highlights jargon like "amortization" or "APR" and shows plain-language definitions on hover.
- **Text-to-Speech** -- Reads page content aloud. Search by keyword, then navigate with Space/K/Esc.
- **Remote Assistance** -- Lets a trusted helper view and interact with your screen via a simple 6-character code. Includes an emergency stop button and keyboard shortcut to end the session at any time.
- **Profiles** -- Save different settings for different family members (Mom, Dad, Son, Daughter, etc.).

## Supported Banks

Works with major Canadian banks including RBC, TD, CIBC, Scotiabank, BMO, Tangerine, ATB, National Bank, Simplii, HSBC Canada, and more.

## Tech Stack

- React (popup UI)
- Chrome Extensions Manifest V3
- WebRTC + Socket.IO (remote assistance)
- Web Speech API (text-to-speech)
- Shadow DOM (isolated sidebar that won't break banking site styles)

## Getting Started

### Prerequisites

- Node.js 14+
- Chrome or Chromium browser

### Install

```bash
git clone <https://github.com/MrStrqfe/404_Fawn.git>
cd fiscal-fox
npm install
```

### Build & Load

```bash
npm run build
```

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `public` folder from this project

The Fawn icon will appear in your toolbar. Click it to open the popup and access all features.

### Development

```bash
npm start       # Start dev server with hot reload
npm test        # Run tests
npm run build   # Production build
```

> **Note:** Changes to content scripts (anything in `public/content/`) require clicking the Reload button on `chrome://extensions/` to take effect.

## Project Structure

```
public/
  manifest.json              # Chrome extension config
  content/
    summarize-transactions.js  # Transaction extraction & categorization
    night-mode.js              # Night mode, colour blind, dyslexic font
    key-terms.js               # Financial term highlighting
    remote-handler.js          # Remote session safety features
  text-to-speech/
    controller.js              # TTS state machine & controls
    speech.js                  # Speech synthesis wrapper
    domReader.js               # DOM keyword search
    uiOverlay.js               # Keyboard input overlay
  settings.html               # Settings page
  settings.js                 # Profile management
  remote-access.html          # Remote assistance UI
  remote-access.js            # WebRTC connection logic
  categories.json             # Transaction category definitions
  dictionary.json             # Financial term definitions
src/
  App.js                     # React popup component
  App.css                    # Popup styles
```

## Safety Features

Remote assistance was designed with vulnerable users in mind:

- Yellow border appears around the page during a remote session
- Emergency Stop button always visible in the bottom-right corner
- Keyboard shortcut **Ctrl+Alt+B** (Cmd+Option+B on Mac) instantly ends the session
- Local user input always takes priority over remote input (2-second cooldown)

## License

This project was built at a hackathon.
