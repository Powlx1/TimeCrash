// src/index.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createWindow, createTray } from './main.js';
import { createDatabase, startActivityTracking, logDatabaseContents, loadSettingsFromLocalStorage } from './tracker.js';
import { __dirname } from './utils.js';

let mainWindow: BrowserWindow;

app.whenReady().then(async () => {
    mainWindow = await createWindow();
    createTray(mainWindow);
    await createDatabase();

    loadSettingsFromLocalStorage(mainWindow);

    await startActivityTracking(mainWindow);
    
    // Log database contents as a test
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
