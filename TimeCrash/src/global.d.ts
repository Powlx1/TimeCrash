interface Window {
  api: {
    getAppUsage: any;
    logActivity: (appName: string, duration: number, date: string) => Promise<{ id: number }>
  };
}
