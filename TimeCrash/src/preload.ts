// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('!!! Preload script executing !!!');

// Use global.d.ts types if available
type ActivityType = 'open' | 'active';

contextBridge.exposeInMainWorld('api', {
    logActivity: (
        appName: string,
        exePath: string,
        duration: number,
        date: string,
        type: ActivityType
    ): Promise<{ id: number }> => {
        console.log('Invoking log-activity:', { appName, exePath, duration, date, type });
        return ipcRenderer.invoke('log-activity', appName, exePath, duration, date, type)
            .catch(error => {
                console.error('Error in logActivity:', error);
                throw error;
            });
    },

    getAppStats: (): Promise<TrackedApp[]> => {
        console.log('Invoking get-app-stats');
        return ipcRenderer.invoke('get-app-stats')
            .catch(error => {
                console.error('Error in getAppStats:', error);
                throw error;
            });
    },

    updateSettings: (settings: PrivacySettings): void => {
        console.log('Sending update-settings:', settings);
        ipcRenderer.send('update-settings', settings);
    },

    getSettings: (): Promise<PrivacySettings> => {
        console.log('Invoking get-settings');
        return ipcRenderer.invoke('get-settings')
            .catch(error => {
                console.error('Error in getSettings:', error);
                throw error;
            });
    },

    saveSettings: (settings: PrivacySettings): Promise<void> => {
        console.log('Invoking save-settings:', settings);
        return ipcRenderer.invoke('save-settings', settings)
            .then(() => console.log('Settings saved successfully'))
            .catch(error => {
                console.error('Error in saveSettings:', error);
                throw error;
            });
    }
});
