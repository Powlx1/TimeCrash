"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
    logActivity: (appName, duration, date) => ipcRenderer.invoke('log-activity', appName, duration, date),
    getAppUsage: () => ipcRenderer.invoke('get-app-usage')
});
