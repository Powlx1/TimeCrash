"use strict";
window.api.getSettings().then((settings) => {
    if (!settings) {
        document.getElementById('privacy-settings-modal')?.setAttribute('style', 'display:block;');
    }
    else {
        loadSettingsUI(settings);
    }
});
window.api.getAppUsage().then((appUsage) => {
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
    const trackWindowTitles = document.getElementById('trackWindowTitles').checked;
    const trackExecutablePaths = document.getElementById('trackExecutablePaths').checked;
    const settings = {
        trackWindowTitles,
        trackExecutablePaths
    };
    window.api.saveSettings(settings);
});
function loadSettingsUI(settings) {
    document.getElementById('trackWindowTitles').checked = settings.trackWindowTitles;
    document.getElementById('trackExecutablePaths').checked = settings.trackExecutablePaths;
}
