import { app, BrowserWindow } from 'electron';
import { createWindow, createTray } from './main.js';
import { createDatabase, startActivityTracking, logDatabaseContents, loadSettingsFromLocalStorage } from './tracker.js';
let mainWindow;
app.whenReady().then(async () => {
    mainWindow = await createWindow();
    createTray(mainWindow);
    await createDatabase();
    loadSettingsFromLocalStorage(mainWindow);
    await startActivityTracking(mainWindow);
    logDatabaseContents();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow().then((win) => (mainWindow = win));
    }
});
process.on('uncaughtException', (err) => {
    console.error('There was an uncaught error:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
