import { ipcMain } from 'electron';
import sqlite3 from 'sqlite3';
import { activeWindow } from 'get-windows';
import ps from 'ps-node';
import path from 'path';
import { __dirname } from './utils.js';
const db = new sqlite3.Database(path.join(__dirname, 'activity_tracker.db'));
let currentApp;
let appUsage = [];
let privacySettings = {
    trackWindowTitles: true,
    trackExecutablePaths: true
};
export async function createDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT,
        exe_path TEXT,
        duration INTEGER,
        date TEXT
    )`, (err) => {
        if (err) {
            console.error('Failed to create database:', err);
        }
    });
}
function logActivity(appName, exePath, duration, date) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO activity (app_name, exe_path, duration, date) VALUES (?, ?, ?, ?)`, [appName, exePath, duration, date], function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve({ id: this.lastID });
            }
        });
    });
}
// Load settings from local storage
export function loadSettingsFromLocalStorage(mainWindow) {
    mainWindow.webContents.executeJavaScript(`localStorage.getItem('privacySettings');`).then((result) => {
        if (result) {
            privacySettings = JSON.parse(result);
            console.log('Loaded Privacy Settings:', privacySettings);
        }
        else {
            console.log('No saved privacy settings found, using defaults.');
        }
    });
}
// Save settings to local storage
function saveSettingsToLocalStorage(mainWindow, settings) {
    mainWindow.webContents.executeJavaScript(`localStorage.setItem('privacySettings', '${JSON.stringify(settings)}');`);
}
async function getProcessExePath(pid) {
    return new Promise((resolve, reject) => {
        ps.lookup({ pid: pid }, (err, resultList) => {
            if (err) {
                reject(err);
            }
            else {
                const process = resultList[0];
                resolve(process ? process.command : '');
            }
        });
    });
}
ipcMain.on('update-settings', (event, newSettings) => {
    privacySettings = { ...privacySettings, ...newSettings };
    console.log('Updated Privacy Settings:', privacySettings);
});
ipcMain.handle('log-activity', async (event, appName, exePath, duration, date) => {
    try {
        const result = await logActivity(appName, exePath, duration, date);
        return result;
    }
    catch (err) {
        console.error('Failed to log activity:', err);
        throw err;
    }
});
ipcMain.handle('get-app-usage', async () => {
    return appUsage;
});
export async function startActivityTracking(mainWindow) {
    setInterval(async () => {
        try {
            const activeWindowData = await activeWindow();
            if (activeWindowData) {
                const appName = activeWindowData.title;
                const pid = activeWindowData.owner.processId;
                const exePath = await getProcessExePath(pid);
                if (privacySettings.trackWindowTitles && privacySettings.trackExecutablePaths) {
                    if (currentApp && (currentApp.name !== appName || currentApp.exePath !== exePath)) {
                        const duration = Date.now() - currentApp.startTime;
                        const date = new Date().toISOString();
                        await logActivity(currentApp.name, currentApp.exePath, duration, date);
                        const existingApp = appUsage.find((app) => app.name === currentApp.name && app.exePath === currentApp.exePath);
                        if (existingApp) {
                            existingApp.duration += duration;
                        }
                        else {
                            appUsage.push({ name: currentApp.name, exePath: currentApp.exePath, duration });
                        }
                        currentApp = { name: appName, exePath, startTime: Date.now() };
                    }
                    else if (!currentApp) {
                        currentApp = { name: appName, exePath, startTime: Date.now() };
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to track activity:', error);
        }
    }, 1000);
}
export function logDatabaseContents() {
    db.all(`SELECT * FROM activity`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching data from database:', err);
            return;
        }
        console.log('Database Contents:');
        rows.forEach((row) => {
            console.log(`ID: ${row.id}, App: ${row.app_name}, ExePath: ${row.exe_path}, Duration: ${row.duration}ms, Date: ${row.date}`);
        });
    });
}
