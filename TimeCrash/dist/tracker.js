import { ipcMain, BrowserWindow } from 'electron';
import sqlite3 from 'sqlite3';
import { activeWindow } from 'get-windows';
import path from 'path';
import { __dirname } from './utils.js';
import { mouse } from '@nut-tree-fork/nut-js';
const db = new sqlite3.Database(path.join(__dirname, 'activity_tracker.db'));
let trackedApps = [];
let activityQueue = [];
let privacySettings = {
    trackWindowTitles: true,
    trackExecutablePaths: true
};
const userAppExes = [
    'spotify.exe',
    'clickerheroes.exe', // Adjust if needed
    'code.exe', // VS Code
    'notepad.exe',
    'chrome.exe',
    'firefox.exe',
    'msedge.exe',
    'opera.exe',
    // Add more as needed
];
export async function createDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT,
            exe_path TEXT,
            duration INTEGER,
            date TEXT,
            type TEXT
        )`, (err) => {
        if (err) {
            console.error('Failed to create database:', err);
        }
    });
}
function logActivity(appName, exePath, duration, date, type) {
    console.log(`Logging activity: App=${appName}, ExePath=${exePath}, Duration=${duration}ms, Date=${date}, Type=${type}`);
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO activity (app_name, exe_path, duration, date, type) VALUES (?, ?, ?, ?, ?)`, [appName, exePath, duration, date, type], function (err) {
            if (err) {
                reject(err);
            }
            else {
                console.log(`Activity logged with ID: ${this.lastID}`);
                resolve({ id: this.lastID });
            }
        });
    });
}
function queueActivity(appName, exePath, duration, date, type) {
    activityQueue.push({ appName, exePath, duration, date, type });
}
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
function saveSettingsToLocalStorage(mainWindow, settings) {
    mainWindow.webContents.executeJavaScript(`localStorage.setItem('privacySettings', '${JSON.stringify(settings)}');`)
        .then(() => {
        console.log('Settings saved to local storage:', settings);
    })
        .catch(err => {
        console.error('Failed to save settings to local storage:', err);
    });
}
async function isMouseInWindow(windowData) {
    const mousePos = await mouse.getPosition();
    const bounds = windowData.bounds;
    return (mousePos.x >= bounds.x &&
        mousePos.x <= bounds.x + bounds.width &&
        mousePos.y >= bounds.y &&
        mousePos.y <= bounds.y + bounds.height);
}
ipcMain.on('update-settings', (event, newSettings) => {
    privacySettings = { ...privacySettings, ...newSettings };
    console.log('Updated Privacy Settings:', privacySettings);
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, privacySettings);
    }
});
ipcMain.handle('log-activity', async (event, appName, exePath, duration, date, type) => {
    try {
        const result = await logActivity(appName, exePath, duration, date, type);
        return result;
    }
    catch (err) {
        console.error('Failed to log activity:', err);
        throw err;
    }
});
ipcMain.handle('get-app-stats', async () => {
    const appStats = trackedApps.map(app => ({
        name: app.name,
        exePath: app.exePath,
        totalOpenDuration: app.totalOpenDuration,
        totalActiveDuration: app.totalActiveDuration
    }));
    console.log('Returning app stats:', appStats);
    return appStats;
});
ipcMain.handle('get-settings', async () => {
    return privacySettings;
});
ipcMain.handle('save-settings', async (event, settings) => {
    privacySettings = settings;
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, settings);
    }
});
export async function startActivityTracking(mainWindow) {
    setInterval(async () => {
        try {
            const activeWin = await activeWindow();
            if (!activeWin || !activeWin.owner)
                return;
            const { processId: pid, path: exePath } = activeWin.owner;
            const exeName = path.basename(exePath).toLowerCase();
            const appName = activeWin.title;
            // Only track user apps
            if (!userAppExes.some(exe => exeName === exe)) {
                return;
            }
            let app = trackedApps.find((a) => a.pid === pid);
            const currentTime = Date.now();
            if (!app) {
                app = { name: appName, exePath, pid, openStartTime: currentTime, totalOpenDuration: 0, totalActiveDuration: 0 };
                trackedApps.push(app);
                console.log(`New app opened: ${appName}, PID=${pid}, ExePath=${exePath}`);
            }
            app.totalOpenDuration = currentTime - app.openStartTime;
            if (await isMouseInWindow(activeWin)) {
                if (!app.activeStartTime) {
                    app.activeStartTime = currentTime;
                    console.log(`App became active: ${appName}`);
                }
                app.totalActiveDuration += currentTime - (app.activeStartTime || currentTime);
                app.activeStartTime = currentTime;
            }
            else if (app.activeStartTime) {
                app.activeStartTime = undefined;
            }
            const date = new Date().toISOString();
            queueActivity(app.name, app.exePath, app.totalOpenDuration, date, 'open');
            if (app.totalActiveDuration > 0) {
                queueActivity(app.name, app.exePath, app.totalActiveDuration, date, 'active');
            }
            // Clean up apps inactive for over 1 minute
            trackedApps = trackedApps.filter(app => app.pid === pid || (Date.now() - app.openStartTime < 60000));
        }
        catch (error) {
            console.error('Error during activity tracking:', error);
        }
    }, 5000); // 5 seconds to reduce load
    setInterval(async () => {
        if (activityQueue.length > 0) {
            const batch = activityQueue;
            activityQueue = [];
            for (const { appName, exePath, duration, date, type } of batch) {
                await logActivity(appName, exePath, duration, date, type);
            }
        }
    }, 300000); // 5 minutes
}
export function logDatabaseContents() {
    db.all(`SELECT * FROM activity`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching data from database:', err);
            return;
        }
        console.log('Database Contents:');
        rows.forEach((row) => {
            console.log(`ID: ${row.id}, App: ${row.app_name}, ExePath: ${row.exe_path}, Duration: ${row.duration}ms, Date: ${row.date}, Type: ${row.type}`);
        });
    });
}
