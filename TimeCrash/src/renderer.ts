// src/renderer.ts
interface PrivacySettings {
    trackWindowTitles: boolean;
    trackExecutablePaths: boolean;
}

interface TrackedApp {
    name: string;
    exePath: string;
    pid: number;
    totalOpenDuration: number;
    totalActiveDuration: number;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Renderer DOM fully loaded");
    console.log("window.api:", window.api);

    const appUsageList = document.getElementById('app-stats') as HTMLElement;

    if (!window.api) {
        console.error("window.api is not defined - check preload script");
        if (appUsageList) appUsageList.innerHTML = "<li>Error: API not loaded</li>";
        return;
    }

    function formatDuration(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    function displayAppUsage(apps: TrackedApp[]) {
        if (!appUsageList) {
            console.error("app-stats element not found");
            return;
        }

        if (!apps || apps.length === 0) {
            appUsageList.innerHTML = "<li>No usage data available.</li>";
            return;
        }

        appUsageList.innerHTML = apps.map(app => `
            <li>
                <strong>${app.name}</strong><br>
                Open Duration: ${formatDuration(app.totalOpenDuration)}<br>
                Active Duration: ${formatDuration(app.totalActiveDuration)}<br>
                <small>Path: ${app.exePath}</small>
            </li>
        `).join('');
    }

    function updateStats() {
        console.log("Calling getAppStats");
        window.api.getAppStats()
            .then(displayAppUsage)
            .catch(error => console.error('Failed to get app stats:', error));
    }

    updateStats();
    setInterval(updateStats, 5000);

    window.api.getSettings().then((settings: PrivacySettings) => {
        if (!settings) {
            document.getElementById('privacy-settings-modal')?.setAttribute('style', 'display:block;');
        } else {
            loadSettingsUI(settings);
        }
    });

    document.getElementById('saveInitialSettings')?.addEventListener('click', () => {
        const trackWindowTitles = (document.getElementById('trackWindowTitles') as HTMLInputElement).checked;
        const trackExecutablePaths = (document.getElementById('trackExecutablePaths') as HTMLInputElement).checked;

        const settings: PrivacySettings = { trackWindowTitles, trackExecutablePaths };
        window.api.saveSettings(settings);
    });

    function loadSettingsUI(settings: PrivacySettings) {
        (document.getElementById('trackWindowTitles') as HTMLInputElement).checked = settings.trackWindowTitles;
        (document.getElementById('trackExecutablePaths') as HTMLInputElement).checked = settings.trackExecutablePaths;
    }
});