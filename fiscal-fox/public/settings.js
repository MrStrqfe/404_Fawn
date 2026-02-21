// ── Profile Management ────────────────────────────────────────────────
let activeProfile = 'Mom'; // Default profile
let profileList = ['Mom', 'Dad', 'Son', 'Daughter'];

const profileContainer = document.getElementById('profileContainer');
const addProfileBtn = document.getElementById('addProfileBtn');

function renderProfiles() {
  profileContainer.innerHTML = '';
  profileList.forEach(profileName => {
    const btn = document.createElement('div');
    btn.className = `profile-btn ${profileName === activeProfile ? 'active' : ''}`;

    // The clickable text area
    const nameSpan = document.createElement('span');
    nameSpan.textContent = profileName;
    nameSpan.style.flex = '1';

    // The inline text input (hidden by default)
    const renameInput = document.createElement('input');
    renameInput.type = 'text';
    renameInput.value = profileName;
    renameInput.style.display = 'none';
    renameInput.style.flex = '1';
    renameInput.style.background = 'rgba(0,0,0,0.3)';
    renameInput.style.color = '#fff';
    renameInput.style.border = '1px solid #4CAF50';
    renameInput.style.padding = '4px 8px';
    renameInput.style.borderRadius = '4px';
    renameInput.style.fontSize = '14px';

    const commitRename = () => {
      const newName = renameInput.value.trim();
      if (!newName || newName === profileName) {
        renameInput.style.display = 'none';
        nameSpan.style.display = 'inline';
        renameInput.value = profileName; // reset
        return;
      }
      if (profileList.includes(newName)) {
        renameInput.style.borderColor = '#ef4444';
        setTimeout(() => { renameInput.style.borderColor = '#4CAF50'; }, 2000);
        return;
      }
      renameProfile(profileName, newName);
    };

    renameInput.addEventListener('blur', commitRename);
    renameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') renameInput.blur();
    });

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.className = 'profile-edit-btn';
    editBtn.style.background = 'none';
    editBtn.style.border = 'none';
    editBtn.style.cursor = 'pointer';
    editBtn.title = 'Rename';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      nameSpan.style.display = 'none';
      renameInput.style.display = 'inline-block';
      renameInput.focus();
    });

    btn.appendChild(nameSpan);
    btn.appendChild(renameInput);
    btn.appendChild(editBtn);

    // Prevent deleting the very last profile
    if (profileList.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'profile-delete-btn';
      delBtn.title = 'Delete profile';
      delBtn.textContent = '❌';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent triggering the profile switch
        deleteProfile(profileName);
      });
      btn.appendChild(delBtn);
    }

    btn.addEventListener('click', (e) => {
      // Only switch if they click the button itself, not the inputs/buttons inside
      if (e.target !== renameInput && e.target !== editBtn && !e.target.classList.contains('profile-delete-btn')) {
        switchProfile(profileName);
      }
    });

    profileContainer.appendChild(btn);
  });
}

function switchProfile(profile) {
  activeProfile = profile;

  // Re-render UI buttons
  renderProfiles();

  // Reload settings for new profile
  loadSettingsForProfile();

  // Save the new active profile to storage
  chrome.storage.sync.set({ activeProfile });
}

function addNewProfile() {
  let count = 1;
  let newName = `New Profile ${count}`;
  while (profileList.includes(newName)) {
    count++;
    newName = `New Profile ${count}`;
  }

  profileList.push(newName);
  chrome.storage.sync.set({ profileList }, () => {
    switchProfile(newName); // Switch to the newly created profile
  });
}

function renameProfile(oldName, newName) {
  const index = profileList.indexOf(oldName);
  if (index === -1) return;

  profileList[index] = newName;
  if (activeProfile === oldName) activeProfile = newName;

  chrome.storage.sync.get(['profiles'], (data) => {
    const profiles = data.profiles || {};
    if (profiles[oldName]) {
      profiles[newName] = profiles[oldName];
      delete profiles[oldName];
    }
    chrome.storage.sync.set({ profileList, profiles, activeProfile }, () => {
      renderProfiles();
    });
  });
}

async function deleteProfile(profileNameToDelete) {
  if (profileList.length <= 1) return; // Prevent deleting last

  const confirmDelete = confirm(`Are you sure you want to delete the profile "${profileNameToDelete}"?`);
  if (!confirmDelete) return;

  // Remove from our list
  profileList = profileList.filter(p => p !== profileNameToDelete);

  // Storage cleanup
  chrome.storage.sync.get(['profiles'], (data) => {
    const profiles = data.profiles || {};
    delete profiles[profileNameToDelete]; // delete data

    let nextProfile = activeProfile;
    if (activeProfile === profileNameToDelete) {
      nextProfile = profileList[0]; // switch to first available if active was deleted
    }

    chrome.storage.sync.set({ profileList, profiles, activeProfile: nextProfile }, () => {
      if (activeProfile !== nextProfile) {
        switchProfile(nextProfile);
      } else {
        renderProfiles(); // just re-render if active didn't change
      }
    });
  });
}

addProfileBtn.addEventListener('click', addNewProfile);

// Load initial profiles array (or seed it)
chrome.storage.sync.get(['profileList', 'activeProfile'], (data) => {
  if (data.profileList && data.profileList.length > 0) {
    profileList = data.profileList;
  } else {
    // Seed initial state
    chrome.storage.sync.set({ profileList });
  }

  if (data.activeProfile && profileList.includes(data.activeProfile)) {
    activeProfile = data.activeProfile;
  } else {
    activeProfile = profileList[0]; // Reset to a valid profile if missing
    chrome.storage.sync.set({ activeProfile });
  }

  renderProfiles();
});


// ── Settings Elements ───────────────────────────────────────────────
const nightModeToggle = document.getElementById('nightModeToggle');
const rememberPerSiteToggle = document.getElementById('rememberPerSite');
const showBadgeToggle = document.getElementById('showBadge');

const colourBlindToggle = document.getElementById('colourBlindToggle');
const cbSliderR = document.getElementById('cbSliderR');
const cbSliderG = document.getElementById('cbSliderG');
const cbSliderB = document.getElementById('cbSliderB');
const cbValR = document.getElementById('cbValR');
const cbValG = document.getElementById('cbValG');
const cbValB = document.getElementById('cbValB');
const cbSlidersBlock = document.getElementById('cbSlidersBlock');
const presetBtns = document.querySelectorAll('.preset-btn[data-preset]');
const customPresetBtn = document.getElementById('customPresetBtn');

const keyTermsToggle = document.getElementById('keyTermsToggle');
const dyslexicReadingToggle = document.getElementById('dyslexicReadingToggle');
const ttsToggle = document.getElementById('ttsToggle');


// ── Unified Loading ───────────────────────────────────────────────
function loadSettingsForProfile() {
  chrome.storage.sync.get(['profiles'], (data) => {
    const profiles = data.profiles || {};
    // Populate defaults if current profile doesn't exist
    const pData = profiles[activeProfile] || {
      globalNightMode: false,
      rememberPerSite: false,
      showBadge: true,
      colourBlindEnabled: false,
      colourBlindPreset: 'none',
      colourBlindR: 100,
      colourBlindG: 100,
      colourBlindB: 100,
      keyTermsEnabled: false,
      dyslexicReadingEnabled: false,
      ttsEnabled: false
    };

    // General toggles
    nightModeToggle.checked = !!pData.globalNightMode;
    rememberPerSiteToggle.checked = !!pData.rememberPerSite;
    showBadgeToggle.checked = pData.showBadge !== false;

    // Colour blind
    colourBlindToggle.checked = !!pData.colourBlindEnabled;
    const r = pData.colourBlindR ?? 100;
    const g = pData.colourBlindG ?? 100;
    const b = pData.colourBlindB ?? 100;
    const preset = pData.colourBlindPreset || 'none';

    cbSliderR.value = r; cbValR.textContent = r;
    cbSliderG.value = g; cbValG.textContent = g;
    cbSliderB.value = b; cbValB.textContent = b;
    setActivePreset(preset);
    cbSlidersBlock.classList.toggle('disabled', preset === 'monochromacy');

    // Accessibility
    keyTermsToggle.checked = !!pData.keyTermsEnabled;
    dyslexicReadingToggle.checked = !!pData.dyslexicReadingEnabled;
    ttsToggle.checked = !!pData.ttsEnabled;
  });
}

// Initial load
loadSettingsForProfile();

// ── Unified Saving ───────────────────────────────────────────────
function saveSetting(key, value) {
  chrome.storage.sync.get(['profiles'], (data) => {
    const profiles = data.profiles || {};
    if (!profiles[activeProfile]) profiles[activeProfile] = {};
    profiles[activeProfile][key] = value;

    // Also save the active profile globally so content scripts know who's driving
    chrome.storage.sync.set({ profiles, activeProfile });
  });
}


// ── Persist General Toggles ────────────────────────────────────────
nightModeToggle.addEventListener('change', () => saveSetting('globalNightMode', nightModeToggle.checked));
rememberPerSiteToggle.addEventListener('change', () => saveSetting('rememberPerSite', rememberPerSiteToggle.checked));
showBadgeToggle.addEventListener('change', () => saveSetting('showBadge', showBadgeToggle.checked));


// ── Colour Blind Mode Logic ────────────────────────────────────────

const CB_PRESETS = {
  none: { r: 100, g: 100, b: 100 },
  deuteranopia: { r: 130, g: 70, b: 100 },
  protanopia: { r: 70, g: 130, b: 100 },
  tritanopia: { r: 100, g: 115, b: 75 },
  monochromacy: { r: 100, g: 100, b: 100 },
};

function setActivePreset(preset) {
  presetBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });
  customPresetBtn.style.display = preset === 'custom' ? 'inline-block' : 'none';
}

function detectPreset(r, g, b) {
  for (const [name, vals] of Object.entries(CB_PRESETS)) {
    if (vals.r === r && vals.g === g && vals.b === b) return name;
  }
  return 'custom';
}

function applyPresetToSliders(preset) {
  const vals = CB_PRESETS[preset];
  if (!vals) return;
  cbSliderR.value = vals.r; cbValR.textContent = vals.r;
  cbSliderG.value = vals.g; cbValG.textContent = vals.g;
  cbSliderB.value = vals.b; cbValB.textContent = vals.b;
  cbSlidersBlock.classList.toggle('disabled', preset === 'monochromacy');
}

colourBlindToggle.addEventListener('change', () => saveSetting('colourBlindEnabled', colourBlindToggle.checked));

// Preset buttons
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    if (preset === 'custom') return;
    setActivePreset(preset);
    applyPresetToSliders(preset);
    const vals = CB_PRESETS[preset];

    // Save batch to avoid multiple async gets
    chrome.storage.sync.get(['profiles'], (data) => {
      const profiles = data.profiles || {};
      if (!profiles[activeProfile]) profiles[activeProfile] = {};
      profiles[activeProfile].colourBlindPreset = preset;
      profiles[activeProfile].colourBlindR = vals.r;
      profiles[activeProfile].colourBlindG = vals.g;
      profiles[activeProfile].colourBlindB = vals.b;
      chrome.storage.sync.set({ profiles, activeProfile });
    });
  });
});

// RGB sliders
function onSliderChange() {
  const r = parseInt(cbSliderR.value, 10);
  const g = parseInt(cbSliderG.value, 10);
  const b = parseInt(cbSliderB.value, 10);
  cbValR.textContent = r;
  cbValG.textContent = g;
  cbValB.textContent = b;
  const detected = detectPreset(r, g, b);
  setActivePreset(detected);
  cbSlidersBlock.classList.toggle('disabled', detected === 'monochromacy');

  chrome.storage.sync.get(['profiles'], (data) => {
    const profiles = data.profiles || {};
    if (!profiles[activeProfile]) profiles[activeProfile] = {};
    profiles[activeProfile].colourBlindPreset = detected;
    profiles[activeProfile].colourBlindR = r;
    profiles[activeProfile].colourBlindG = g;
    profiles[activeProfile].colourBlindB = b;
    chrome.storage.sync.set({ profiles, activeProfile });
  });
}

cbSliderR.addEventListener('input', onSliderChange);
cbSliderG.addEventListener('input', onSliderChange);
cbSliderB.addEventListener('input', onSliderChange);


// ── Accessibility Toggles ────────────────────────────────────────────
keyTermsToggle.addEventListener('change', () => saveSetting('keyTermsEnabled', keyTermsToggle.checked));
dyslexicReadingToggle.addEventListener('change', () => saveSetting('dyslexicReadingEnabled', dyslexicReadingToggle.checked));
ttsToggle.addEventListener('change', () => saveSetting('ttsEnabled', ttsToggle.checked));


// ── Keyboard Navigation (Vimium-style) ───────────────────────────────
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    if (e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  }

  const focusableSelector = 'input[type="checkbox"], select, input[type="range"], .preset-btn, .profile-btn, button';
  const focusableElements = Array.from(document.querySelectorAll(focusableSelector))
    .filter(el => {
      if (el.classList.contains('disabled') || el.closest('.disabled') || el.closest('.sliders-block.disabled')) return false;
      if (el.style.display === 'none' || getComputedStyle(el).display === 'none') return false;
      return true;
    });

  if (focusableElements.length === 0) return;

  const currentIndex = focusableElements.indexOf(document.activeElement);

  if (e.key === 'j') {
    e.preventDefault();
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    focusableElements[nextIndex].focus();
  } else if (e.key === 'k') {
    e.preventDefault();
    const prevIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
    focusableElements[prevIndex].focus();
  }
});


