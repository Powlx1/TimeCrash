"use strict";
// src/preload.ts
if (typeof process !== 'undefined' && process.type === 'renderer') {
    console.log('Preload script loaded successfully');
    window.api = {
        logActivity: (appName, exePath, duration, date) => {
            return window.require('electron').ipcRenderer.invoke('log-activity', appName, exePath, duration, date);
        },
        getAppUsage: () => {
            return window.require('electron').ipcRenderer.invoke('get-app-usage');
        },
        updateSettings: (settings) => {
            return window.require('electron').ipcRenderer.send('update-settings', settings);
        },
        getSettings: () => {
            return window.require('electron').ipcRenderer.invoke('get-settings');
        },
        saveSettings: (settings) => {
            return window.require('electron').ipcRenderer.invoke('save-settings', settings)
                .then(() => {
                alert('Settings saved successfully!');
            })
                .catch((err) => {
                console.error('Failed to save settings:', err);
            });
        }
    };
}
else {
    console.warn('Electron IPC methods are not available.');
}
