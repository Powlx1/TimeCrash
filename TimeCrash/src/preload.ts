const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  logActivity: (appName: string, duration: number, date: string) => ipcRenderer.invoke('log-activity', appName, duration, date),
  getAppUsage: () => ipcRenderer.invoke('get-app-usage')
});
