// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('!!! Preload script executing !!!');

type ActivityType = 'open' | 'active';

interface DailyAppStats {
    name: string;
    exePath: string;
    totalOpenDuration: number;
    totalActiveDuration: number;
}

interface AppCoUsage {
    app1_name: string;
    app1_exePath: string;
    app2_name: string;
    app2_exePath: string;
    co_usage_duration: number;
    date: string;
}

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
    },

    getAvailableDates: (): Promise<string[]> => {
        console.log('Invoking get-available-dates');
        return ipcRenderer.invoke('get-available-dates')
            .catch(error => {
                console.error('Error in getAvailableDates:', error);
                throw error;
            });
    },

    getDailyAppStats: (date: string): Promise<DailyAppStats[]> => {
        console.log(`Invoking get-daily-app-stats for date: ${date}`);
        return ipcRenderer.invoke('get-daily-app-stats', date)
            .catch(error => {
                console.error(`Error in getDailyAppStats for date ${date}:`, error);
                throw error;
            });
    },

    getCoUsageStats: (date: string): Promise<AppCoUsage[]> => {
        console.log(`Invoking get-co-usage-stats for date: ${date}`);
        return ipcRenderer.invoke('get-co-usage-stats', date)
            .catch(error => {
                console.error(`Error in getCoUsageStats for date ${date}:`, error);
                throw error;
            });
    },

    cleanCoUsage: (): Promise<void> => {
        console.log('Invoking clean-co-usage');
        return ipcRenderer.invoke('clean-co-usage')
            .catch(error => {
                console.error('Error in cleanCoUsage:', error);
                throw error;
            });
    }
});