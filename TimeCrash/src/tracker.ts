import { ipcMain, BrowserWindow } from 'electron';
import sqlite3 from 'sqlite3';
import { activeWindow } from 'get-windows';
import ps from 'ps-node';
import path from 'path';
import { __dirname } from './utils.js';

const db = new sqlite3.Database(path.join(__dirname, 'activity_tracker.db'));

let currentApp: { name: string; exePath: string; startTime: number } | null = null;
let appUsage: { name: string; exePath: string; duration: number }[] = [];

let privacySettings = {
    trackWindowTitles: true,
    trackExecutablePaths: true
};

export async function createDatabase(): Promise<void> {
    db.run(
        `CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT,
            exe_path TEXT,
            duration INTEGER,
            date TEXT
        )`,
        (err) => {
            if (err) {
                console.error('Failed to create database:', err);
            }
        }
    );
}

function logActivity(appName: string, exePath: string, duration: number, date: string): Promise<{ id: number }> {
    console.log(`Logging activity: App=${appName}, ExePath=${exePath}, Duration=${duration}ms, Date=${date}`);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO activity (app_name, exe_path, duration, date) VALUES (?, ?, ?, ?)`,
            [appName, exePath, duration, date],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Activity logged successfully with ID: ${this.lastID}`);
                    resolve({ id: this.lastID });
                }
            }
        );
    });
}

export function loadSettingsFromLocalStorage(mainWindow: BrowserWindow) {
    mainWindow.webContents.executeJavaScript(`localStorage.getItem('privacySettings');`).then((result) => {
        if (result) {
            privacySettings = JSON.parse(result);
            console.log('Loaded Privacy Settings:', privacySettings);
        } else {
            console.log('No saved privacy settings found, using defaults.');
        }
    });
}

function saveSettingsToLocalStorage(mainWindow: BrowserWindow, settings: { trackWindowTitles: boolean, trackExecutablePaths: boolean }) {
    mainWindow.webContents.executeJavaScript(`localStorage.setItem('privacySettings', '${JSON.stringify(settings)}');`)
        .then(() => {
            console.log('Settings saved to local storage:', settings);
        })
        .catch(err => {
            console.error('Failed to save settings to local storage:', err);
        });
}

async function getProcessExePath(pid: number): Promise<string> {
    return new Promise((resolve, reject) => {
        ps.lookup({ pid: pid }, (err: any, resultList: any[]) => {
            if (err) {
                reject(err);
            } else {
                const process = resultList[0];
                resolve(process ? process.command : '');
            }
        });
    });
}

ipcMain.on('update-settings', (event, newSettings: { trackWindowTitles: boolean, trackExecutablePaths: boolean }) => {
    privacySettings = { ...privacySettings, ...newSettings };
    console.log('Updated Privacy Settings:', privacySettings);

    console.log(`Settings Updated: trackWindowTitles=${newSettings.trackWindowTitles}, trackExecutablePaths=${newSettings.trackExecutablePaths}`);

    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, privacySettings);
    }
});


ipcMain.handle('log-activity', async (event, appName: string, exePath: string, duration: number, date: string) => {
    try {
        const result = await logActivity(appName, exePath, duration, date);
        return result;
    } catch (err) {
        console.error('Failed to log activity:', err);
        throw err;
    }
});

ipcMain.handle('get-app-usage', async () => {
    return appUsage;
});

export async function startActivityTracking(mainWindow: BrowserWindow): Promise<void> {
    const browserNames = ["chrome.exe", "opera.exe", "firefox.exe", "msedge.exe"];
    
    setInterval(async () => {
        try {
            const activeWindowData = await activeWindow();
            if (activeWindowData) {
                const pid = activeWindowData.owner.processId;
                const exePath = await getProcessExePath(pid);
                const appName = browserNames.includes(exePath.toLowerCase()) ? activeWindowData.owner.name : activeWindowData.title;

                if (currentApp && (currentApp.name !== appName || currentApp.exePath !== exePath)) {
                    const duration = Date.now() - currentApp.startTime;
                    const date = new Date().toISOString();
                    
                    setTimeout(async () => {
                        await logActivity(currentApp!.name, currentApp!.exePath, duration, date);
                    }, 500);

                    const existingApp = appUsage.find((app) => app.name === currentApp!.name && app.exePath === currentApp!.exePath);
                    if (existingApp) {
                        existingApp.duration += duration;
                    } else {
                        appUsage.push({ name: currentApp!.name, exePath: currentApp!.exePath, duration });
                    }

                    currentApp = { name: appName, exePath, startTime: Date.now() };

                    console.log(`Switched to new app: App=${appName}, ExePath=${exePath}, StartTime=${currentApp.startTime}`);
                } else if (!currentApp) {
                    currentApp = { name: appName, exePath, startTime: Date.now() };

                    console.log(`Started tracking app: App=${appName}, ExePath=${exePath}, StartTime=${currentApp.startTime}`);
                }
            }
        } catch (error) {
            console.error('Failed to track activity:', error);
        }
    }, 5000);
}

export function logDatabaseContents(): void {
    db.all(`SELECT * FROM activity`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching data from database:', err);
            return;
        }
        console.log('Database Contents:');
        rows.forEach((row: any) => {
            console.log(`ID: ${row.id}, App: ${row.app_name}, ExePath: ${row.exe_path}, Duration: ${row.duration}ms, Date: ${row.date}`);
        });
    });
}
