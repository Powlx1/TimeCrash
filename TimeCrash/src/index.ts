import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createWindow, createTray } from './main';
import { createDatabase, startActivityTracking, logDatabaseContents, loadSettingsFromLocalStorage } from './tracker';

let mainWindow: BrowserWindow;

app.whenReady().then(async () => {
    mainWindow = await createWindow();
    try {
        await createDatabase();
        createTray(mainWindow);
        loadSettingsFromLocalStorage(mainWindow);
        try {
            await startActivityTracking(mainWindow);
        } catch (err) {
            console.error('Failed to start activity tracking:', err);
        }
        logDatabaseContents();
    } catch (err) {
        console.error('Error during app initialization:', err);
    }
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