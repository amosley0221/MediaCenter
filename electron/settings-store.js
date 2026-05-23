const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_SETTINGS = {
  audio: {
    nightMode: false,
    spatialAudio: false,
    volumeStep: 5,
  },
  appearance: {
    theme: "default",
    wallpaper: "default",
  },
  controllers: {
    buttonHints: true,
    gamepadNavigation: true,
    pointerSpeed: 5,
  },
  display: {
    fullscreenStartup: true,
    launchMediaCenter: false,
    overscan: 0,
    taskbarReveal: true,
  },
  metadata: {
    musicBrainzEnabled: false,
    openLibraryEnabled: false,
    rawgApiKey: "",
    rawgEnabled: false,
    steamArtworkEnabled: true,
    tmdbApiKey: "",
    tmdbEnabled: false,
  },
  mediaServer: {
    directPlay: true,
    discovery: true,
    enabled: false,
    name: "ToneOS Living Room",
    pin: "",
    port: 8096,
    sameNetworkOnly: true,
  },
};

function mergeSettings(settings = {}) {
  return {
    audio: {
      ...DEFAULT_SETTINGS.audio,
      ...(settings.audio || {}),
    },
    appearance: {
      ...DEFAULT_SETTINGS.appearance,
      ...(settings.appearance || {}),
    },
    controllers: {
      ...DEFAULT_SETTINGS.controllers,
      ...(settings.controllers || {}),
    },
    display: {
      ...DEFAULT_SETTINGS.display,
      ...(settings.display || {}),
    },
    metadata: {
      ...DEFAULT_SETTINGS.metadata,
      ...(settings.metadata || {}),
    },
    mediaServer: {
      ...DEFAULT_SETTINGS.mediaServer,
      ...(settings.mediaServer || {}),
    },
  };
}

function loadSettingsSync(settingsPath) {
  try {
    return mergeSettings(JSON.parse(fs.readFileSync(settingsPath, "utf8")));
  } catch {
    return mergeSettings();
  }
}

async function loadSettings(settingsPath) {
  try {
    return mergeSettings(JSON.parse(await fsp.readFile(settingsPath, "utf8")));
  } catch {
    return mergeSettings();
  }
}

async function saveSettings(settingsPath, settings) {
  const nextSettings = mergeSettings(settings);
  await fsp.mkdir(path.dirname(settingsPath), { recursive: true });
  await fsp.writeFile(settingsPath, `${JSON.stringify(nextSettings, null, 2)}\n`);
  return nextSettings;
}

module.exports = {
  DEFAULT_SETTINGS,
  loadSettings,
  loadSettingsSync,
  mergeSettings,
  saveSettings,
};
