// src/renderer.ts
interface PrivacySettings {
    trackWindowTitles: boolean;
    trackExecutablePaths: boolean;
}

window.api.getSettings().then((settings: PrivacySettings) => {
    if (!settings) {
        document.getElementById('privacy-settings-modal')?.setAttribute('style', 'display:block;');
    } else {
        loadSettingsUI(settings);
    }
});

window.api.getAppUsage().then((appUsage: { name: string, exePath: string, duration: number, date: string }[]) => {
    const appUsageList = document.getElementById('app-usage-list');
    if (appUsageList) {
        appUsageList.innerHTML = appUsage.map(app => `
            <li>
                App: ${app.name}, ExePath: ${app.exePath}, Duration: ${app.duration}ms, Date: ${app.date}
            </li>
        `).join('');
    }
}).catch(error => {
    console.error('Failed to get app usage:', error);
});


document.getElementById('saveInitialSettings')?.addEventListener('click', () => {
    const trackWindowTitles = (document.getElementById('trackWindowTitles') as HTMLInputElement).checked;
    const trackExecutablePaths = (document.getElementById('trackExecutablePaths') as HTMLInputElement).checked;

    const settings: PrivacySettings = {
        trackWindowTitles,
        trackExecutablePaths
    };

    window.api.saveSettings(settings);
});


function loadSettingsUI(settings: PrivacySettings) {
    (document.getElementById('trackWindowTitles') as HTMLInputElement).checked = settings.trackWindowTitles;
    (document.getElementById('trackExecutablePaths') as HTMLInputElement).checked = settings.trackExecutablePaths;
}

