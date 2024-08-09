var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// src/index.ts
import { app, BrowserWindow } from 'electron';
import { createWindow, createTray } from './main.js';
import { createDatabase, startActivityTracking, logDatabaseContents } from './tracker.js';
let mainWindow;
app.whenReady().then(() => __awaiter(void 0, void 0, void 0, function* () {
    mainWindow = yield createWindow();
    createTray(mainWindow);
    yield createDatabase();
    yield startActivityTracking(mainWindow);
    logDatabaseContents();
}));
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
