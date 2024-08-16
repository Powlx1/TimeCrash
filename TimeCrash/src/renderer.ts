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

document.getElementById('saveSettings')?.addEventListener('click', () => {
    const trackWindowTitles = (document.getElementById('trackWindowTitles') as HTMLInputElement).checked;
    const trackExecutablePaths = (document.getElementById('trackExecutablePaths') as HTMLInputElement).checked;

    window.api.updateSettings({
        trackWindowTitles,
        trackExecutablePaths
    });

    alert('Settings saved!');
});

function loadSettingsUI(settings: PrivacySettings) {
    (document.getElementById('trackWindowTitles') as HTMLInputElement).checked = settings.trackWindowTitles;
    (document.getElementById('trackExecutablePaths') as HTMLInputElement).checked = settings.trackExecutablePaths;
}
