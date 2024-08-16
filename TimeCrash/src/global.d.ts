interface PrivacySettings {
  trackWindowTitles: boolean;
  trackExecutablePaths: boolean;
}

interface Window {
  api: {
      logActivity: (appName: string, exePath: string, duration: number, date: string) => Promise<{ id: number }>;
      getAppUsage: () => Promise<any>;
      updateSettings: (settings: PrivacySettings) => void;
      getSettings: () => Promise<PrivacySettings>;
      saveSettings: (settings: PrivacySettings) => void;
  };
}
