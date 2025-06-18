"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log('!!! Preload script executing !!!');
electron_1.contextBridge.exposeInMainWorld('api', {
    logActivity: (appName, exePath, duration, date, type) => {
        console.log('Invoking log-activity:', { appName, exePath, duration, date, type });
        return electron_1.ipcRenderer.invoke('log-activity', appName, exePath, duration, date, type)
            .catch(error => {
            console.error('Error in logActivity:', error);
            throw error;
        });
    },
    getAppStats: () => {
        console.log('Invoking get-app-stats');
        return electron_1.ipcRenderer.invoke('get-app-stats')
            .catch(error => {
            console.error('Error in getAppStats:', error);
            throw error;
        });
    },
    updateSettings: (settings) => {
        console.log('Sending update-settings:', settings);
        electron_1.ipcRenderer.send('update-settings', settings);
    },
    getSettings: () => {
        console.log('Invoking get-settings');
        return electron_1.ipcRenderer.invoke('get-settings')
            .catch(error => {
            console.error('Error in getSettings:', error);
            throw error;
        });
    },
    saveSettings: (settings) => {
        console.log('Invoking save-settings:', settings);
        return electron_1.ipcRenderer.invoke('save-settings', settings)
            .then(() => console.log('Settings saved successfully'))
            .catch(error => {
            console.error('Error in saveSettings:', error);
            throw error;
        });
    },
    getAvailableDates: () => {
        console.log('Invoking get-available-dates');
        return electron_1.ipcRenderer.invoke('get-available-dates')
            .catch(error => {
            console.error('Error in getAvailableDates:', error);
            throw error;
        });
    },
    getDailyAppStats: (date) => {
        console.log(`Invoking get-daily-app-stats for date: ${date}`);
        return electron_1.ipcRenderer.invoke('get-daily-app-stats', date)
            .catch(error => {
            console.error(`Error in getDailyAppStats for date ${date}:`, error);
            throw error;
        });
    },
    getCoUsageStats: (date) => {
        console.log(`Invoking get-co-usage-stats for date: ${date}`);
        return electron_1.ipcRenderer.invoke('get-co-usage-stats', date)
            .catch(error => {
            console.error(`Error in getCoUsageStats for date ${date}:`, error);
            throw error;
        });
    },
    cleanCoUsage: () => {
        console.log('Invoking clean-co-usage');
        return electron_1.ipcRenderer.invoke('clean-co-usage')
            .catch(error => {
            console.error('Error in cleanCoUsage:', error);
            throw error;
        });
    }
});
