const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "mediaCenterDesktop",
  Object.freeze({
    isElectron: true,
    pickSourceFolder: (sourceKey) => ipcRenderer.invoke("media:pick-source-folder", { sourceKey }),
    revealPath: (filePath) => ipcRenderer.invoke("media:reveal-path", filePath),
    scanSteamLibrary: () => ipcRenderer.invoke("media:scan-steam"),
  }),
);
