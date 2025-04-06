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

interface Window {
    api: {
        logActivity: (appName: string, exePath: string, duration: number, date: string, type: 'open' | 'active') => Promise<{ id: number }>;
        getAppStats: () => Promise<TrackedApp[]>;
        updateSettings: (settings: PrivacySettings) => void;
        getSettings: () => Promise<PrivacySettings>;
        saveSettings: (settings: PrivacySettings) => void;
    };
}
