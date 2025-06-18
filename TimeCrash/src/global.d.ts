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

interface Window {
    api: {
        logActivity: (appName: string, exePath: string, duration: number, date: string, type: 'open' | 'active') => Promise<{ id: number }>;
        getAppStats: () => Promise<TrackedApp[]>;
        updateSettings: (settings: PrivacySettings) => void;
        getSettings: () => Promise<PrivacySettings>;
        saveSettings: (settings: PrivacySettings) => Promise<void>;
        getAvailableDates: () => Promise<string[]>;
        getDailyAppStats: (date: string) => Promise<DailyAppStats[]>;
        getCoUsageStats: (date: string) => Promise<AppCoUsage[]>;
        cleanCoUsage: () => Promise<void>;
    };
}