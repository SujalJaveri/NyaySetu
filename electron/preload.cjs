const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nyayasetuDesktop", {
  isDesktop: true,
  platform: process.platform,
  version: "1.0.0",
  retryConnection: () => ipcRenderer.send("retry-connection"),
});
