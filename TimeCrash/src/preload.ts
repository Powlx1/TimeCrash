// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    logActivity: (appName: string, exePath: string, duration: number, date: string) => ipcRenderer.invoke('log-activity', appName, exePath, duration, date),
    getAppUsage: () => ipcRenderer.invoke('get-app-usage'),
    updateSettings: (settings: { trackWindowTitles: boolean, trackExecutablePaths: boolean }) => ipcRenderer.send('update-settings', settings),
});
