// src/preload.ts

if (typeof process !== 'undefined' && process.type === 'renderer') {
    console.log('Preload script loaded successfully');

    window.api = {
        logActivity: (appName: string, exePath: string, duration: number, date: string) => {
            return (window as any).require('electron').ipcRenderer.invoke('log-activity', appName, exePath, duration, date);
        },
        getAppUsage: () => {
            return (window as any).require('electron').ipcRenderer.invoke('get-app-usage');
        },
        updateSettings: (settings: { trackWindowTitles: boolean, trackExecutablePaths: boolean }) => {
            return (window as any).require('electron').ipcRenderer.send('update-settings', settings);
        },
        getSettings: () => {
            return (window as any).require('electron').ipcRenderer.invoke('get-settings');
        },
        saveSettings: (settings: { trackWindowTitles: boolean, trackExecutablePaths: boolean }) => {
            return (window as any).require('electron').ipcRenderer.invoke('save-settings', settings)
                .then(() => {
                    alert('Settings saved successfully!');
                })
                .catch((err: any)=> {
                    console.error('Failed to save settings:', err);
                });
        }
    };
} else {
    console.warn('Electron IPC methods are not available.');
}
