"use strict";
window.api.getSettings().then((settings) => {
    if (!settings) {
        document.getElementById('privacy-settings-modal')?.setAttribute('style', 'display:block;');
    }
    else {
        loadSettingsUI(settings);
    }
});
document.getElementById('saveSettings')?.addEventListener('click', () => {
    const trackWindowTitles = document.getElementById('trackWindowTitles').checked;
    const trackExecutablePaths = document.getElementById('trackExecutablePaths').checked;
    window.api.updateSettings({
        trackWindowTitles,
        trackExecutablePaths
    });
    alert('Settings saved!');
});
function loadSettingsUI(settings) {
    document.getElementById('trackWindowTitles').checked = settings.trackWindowTitles;
    document.getElementById('trackExecutablePaths').checked = settings.trackExecutablePaths;
}
