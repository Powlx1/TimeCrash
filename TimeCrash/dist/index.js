"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const main_1 = require("./main");
const tracker_1 = require("./tracker");
let mainWindow;
electron_1.app.whenReady().then(async () => {
    mainWindow = await (0, main_1.createWindow)();
    try {
        await (0, tracker_1.createDatabase)();
        (0, main_1.createTray)(mainWindow);
        (0, tracker_1.loadSettingsFromLocalStorage)(mainWindow);
        try {
            await (0, tracker_1.startActivityTracking)(mainWindow);
        }
        catch (err) {
            console.error('Failed to start activity tracking:', err);
        }
        (0, tracker_1.logDatabaseContents)();
    }
    catch (err) {
        console.error('Error during app initialization:', err);
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        (0, main_1.createWindow)().then((win) => (mainWindow = win));
    }
});
process.on('uncaughtException', (err) => {
    console.error('There was an uncaught error:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
