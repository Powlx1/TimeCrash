// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
    logActivity: (appName, exePath, duration, date) => ipcRenderer.invoke('log-activity', appName, exePath, duration, date),
    getAppUsage: () => ipcRenderer.invoke('get-app-usage'),
    updateSettings: (settings) => ipcRenderer.send('update-settings', settings),
});
