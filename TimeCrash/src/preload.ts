// src/preload.ts
const { ipcRenderer } = require('electron');

console.log('Preload script loaded successfully');

window.api = {
    logActivity: (appName, exePath, duration, date, type) => {
        console.log('Invoking log-activity:', { appName, exePath, duration, date, type });
        return ipcRenderer.invoke('log-activity', appName, exePath, duration, date, type)
            .catch(error => {
                console.error('Error in logActivity:', error);
                throw error;
            });
    },
    getAppStats: () => {
        console.log('Invoking get-app-stats');
        return ipcRenderer.invoke('get-app-stats')
            .catch(error => {
                console.error('Error in getAppStats:', error);
                throw error;
            });
    },
    updateSettings: (settings) => {
        console.log('Sending update-settings:', settings);
        ipcRenderer.send('update-settings', settings);
    },
    getSettings: () => {
        console.log('Invoking get-settings');
        return ipcRenderer.invoke('get-settings')
            .catch(error => {
                console.error('Error in getSettings:', error);
                throw error;
            });
    },
    saveSettings: (settings) => {
        console.log('Invoking save-settings:', settings);
        return ipcRenderer.invoke('save-settings', settings)
            .then(() => console.log('Settings saved successfully'))
            .catch(error => {
                console.error('Error in saveSettings:', error);
                throw error;
            });
    }
};