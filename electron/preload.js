const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "mediaCenterDesktop",
  Object.freeze({
    isElectron: true,
    loadLibrary: () => ipcRenderer.invoke("media:load-library"),
    openMediaItem: (item) => ipcRenderer.invoke("media:open-item", item),
    pickSourceFolder: (sourceKey) => ipcRenderer.invoke("media:pick-source-folder", { sourceKey }),
    revealPath: (filePath) => ipcRenderer.invoke("media:reveal-path", filePath),
    scanMediaSource: (sourceKey, paths) => ipcRenderer.invoke("media:scan-source", { sourceKey, paths }),
    scanSteamLibrary: () => ipcRenderer.invoke("media:scan-steam"),
    getMediaServerStatus: () => ipcRenderer.invoke("media-server:status"),
    openMediaServerClient: () => ipcRenderer.invoke("media-server:open-client"),
    loadStreamingData: () => ipcRenderer.invoke("streaming:load"),
    loadSettings: () => ipcRenderer.invoke("settings:load"),
    onRemoteCommand: (callback) => {
      if (typeof callback !== "function") {
        return () => {};
      }

      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("remote:command", listener);
      return () => ipcRenderer.removeListener("remote:command", listener);
    },
    saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  }),
);
