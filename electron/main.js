const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { loadLibrary, upsertScannedSource, upsertSteamScan } = require("./media-library");
const { createMediaServer } = require("./media-server");
const { loadSettings, loadSettingsSync, saveSettings } = require("./settings-store");
const { scanSteamLibraries } = require("./steam-scanner");
const { loadStreamingData } = require("./streaming-providers");

const SOURCE_TITLES = {
  books: "Choose books, comics, or a reading folder",
  games: "Choose a games folder",
  local: "Choose local media files or folders",
  movies: "Choose a movies folder",
  network: "Choose a network share",
  tv: "Choose a TV shows folder",
  watch: "Choose a folder to watch",
};

const FILE_AND_FOLDER_SOURCES = new Set(["books", "local"]);

let mainWindow = null;
let mediaServer = null;

function getLibraryPath() {
  return path.join(app.getPath("userData"), "media-library.json");
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getMediaServer() {
  if (!mediaServer) {
    mediaServer = createMediaServer({
      getLibraryPath,
      getSettingsPath,
      loadSettings,
    });
  }

  return mediaServer;
}

async function syncMediaServer(settings) {
  return getMediaServer().configure(settings);
}

function createWindow() {
  const settings = loadSettingsSync(getSettingsPath());

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#000000",
    frame: false,
    fullscreen: process.env.MEDIA_CENTER_WINDOWED !== "1" && settings.display.fullscreenStartup,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(async () => {
  const settings = loadSettingsSync(getSettingsPath());

  createWindow();
  await syncMediaServer(settings);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  getMediaServer().stop();
});

ipcMain.handle("media:pick-source-folder", async (_event, payload = {}) => {
  const sourceKey = payload.sourceKey || "local";
  const properties = FILE_AND_FOLDER_SOURCES.has(sourceKey)
    ? ["openFile", "openDirectory", "multiSelections"]
    : ["openDirectory"];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: SOURCE_TITLES[sourceKey] || "Choose a media folder",
    buttonLabel: FILE_AND_FOLDER_SOURCES.has(sourceKey) ? "Add Media" : "Add Folder",
    properties,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return {
    canceled: false,
    path: result.filePaths[0],
    paths: result.filePaths,
    sourceKey,
  };
});

ipcMain.handle("media:scan-steam", async () => {
  const steamScan = await scanSteamLibraries();
  const settings = await loadSettings(getSettingsPath());
  return upsertSteamScan(getLibraryPath(), steamScan, settings.metadata);
});

ipcMain.handle("media:reveal-path", async (_event, filePath) => {
  if (!filePath) {
    return { ok: false };
  }

  shell.showItemInFolder(filePath);
  return { ok: true };
});

ipcMain.handle("media:load-library", async () => {
  return loadLibrary(getLibraryPath());
});

ipcMain.handle("media:scan-source", async (_event, payload = {}) => {
  const sourceKey = payload.sourceKey || "local";
  const sourcePaths = Array.isArray(payload.paths) && payload.paths.length ? payload.paths : [payload.path];
  const settings = await loadSettings(getSettingsPath());
  return upsertScannedSource(getLibraryPath(), sourceKey, sourcePaths, settings.metadata);
});

ipcMain.handle("media-server:status", async () => {
  return getMediaServer().getStatus();
});

ipcMain.handle("media-server:open-client", async () => {
  const status = await getMediaServer().getStatus();
  const url = status.urls?.find((clientUrl) => !clientUrl.includes("127.0.0.1")) || status.urls?.[0];

  if (url) {
    await shell.openExternal(url);
  }

  return status;
});

ipcMain.handle("media:open-item", async (_event, item = {}) => {
  if (item.launchUrl) {
    await shell.openExternal(item.launchUrl);
    return { ok: true };
  }

  if (item.path) {
    const error = await shell.openPath(item.path);
    return { ok: !error, error };
  }

  return { ok: false, error: "No playable path was available for this item." };
});

ipcMain.handle("streaming:load", async () => {
  const settings = await loadSettings(getSettingsPath());
  return loadStreamingData(settings.streamingProviders);
});

ipcMain.handle("settings:load", async () => {
  return loadSettings(getSettingsPath());
});

ipcMain.handle("settings:save", async (_event, settings = {}) => {
  const savedSettings = await saveSettings(getSettingsPath(), settings);
  await syncMediaServer(savedSettings);
  return savedSettings;
});
