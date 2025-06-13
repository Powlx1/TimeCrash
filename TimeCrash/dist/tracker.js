"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabase = createDatabase;
exports.loadSettingsFromLocalStorage = loadSettingsFromLocalStorage;
exports.startActivityTracking = startActivityTracking;
exports.logDatabaseContents = logDatabaseContents;
const electron_1 = require("electron");
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const nut_js_1 = require("@nut-tree-fork/nut-js");
const db = new sqlite3_1.default.Database(path_1.default.join(__dirname, 'activity_tracker.db'));
let trackedApps = [];
let activityQueue = [];
let privacySettings = {
    trackWindowTitles: true,
    trackExecutablePaths: true
};
async function createDatabase() {
    return new Promise((resolve, reject) => {
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
                reject(err);
            }
            else {
                console.log('Database table created or already exists');
                resolve();
            }
        });
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
function loadSettingsFromLocalStorage(mainWindow) {
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
    const mousePos = await nut_js_1.mouse.getPosition();
    const bounds = windowData.bounds;
    return (mousePos.x >= bounds.x &&
        mousePos.x <= bounds.x + bounds.width &&
        mousePos.y >= bounds.y &&
        mousePos.y <= bounds.y + bounds.height);
}
electron_1.ipcMain.on('update-settings', (event, newSettings) => {
    privacySettings = { ...privacySettings, ...newSettings };
    console.log('Updated Privacy Settings:', privacySettings);
    const mainWindow = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, privacySettings);
    }
});
electron_1.ipcMain.handle('log-activity', async (event, appName, exePath, duration, date, type) => {
    try {
        const result = await logActivity(appName, exePath, duration, date, type);
        return result;
    }
    catch (err) {
        console.error('Failed to log activity:', err);
        throw err;
    }
});
electron_1.ipcMain.handle('get-app-stats', async () => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT app_name AS name, exe_path AS exePath, 
                   SUM(CASE WHEN type = 'open' THEN duration ELSE 0 END) AS totalOpenDuration,
                   SUM(CASE WHEN type = 'active' THEN duration ELSE 0 END) AS totalActiveDuration
            FROM activity
            GROUP BY exe_path
        `, [], (err, rows) => {
            if (err) {
                console.error('Error fetching app stats:', err);
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
});
electron_1.ipcMain.handle('get-settings', async () => {
    return privacySettings;
});
electron_1.ipcMain.handle('save-settings', async (event, settings) => {
    privacySettings = settings;
    const mainWindow = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, settings);
    }
});
async function startActivityTracking(mainWindow) {
    console.log('Attempting to import get-windows');
    let activeWindow;
    try {
        // Force dynamic import to avoid CommonJS require transformation
        const getWindowsModule = await eval('import("get-windows")');
        activeWindow = getWindowsModule.activeWindow;
        console.log('get-windows imported successfully');
    }
    catch (error) {
        console.error('Failed to import get-windows:', error);
        return; // Exit to allow app to continue without tracking
    }
    setInterval(async () => {
        try {
            const activeWin = await activeWindow();
            if (activeWin && activeWin.owner) {
                const { processId: pid, name, path: exePath } = activeWin.owner;
                let app = trackedApps.find((a) => a.pid === pid);
                const currentTime = Date.now();
                if (!app) {
                    app = { name, exePath, pid, openStartTime: currentTime, totalOpenDuration: 0, totalActiveDuration: 0 };
                    trackedApps.push(app);
                    console.log(`New app opened: ${name}, PID=${pid}, ExePath=${exePath}`);
                }
                app.totalOpenDuration = currentTime - app.openStartTime;
                if (await isMouseInWindow(activeWin)) {
                    if (!app.activeStartTime) {
                        app.activeStartTime = currentTime;
                        console.log(`App became active: ${name}`);
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
            }
        }
        catch (error) {
            console.error('Error while tracking activity:', error);
        }
    }, 1000);
    setInterval(async () => {
        const activitiesToLog = [...activityQueue];
        activityQueue = [];
        for (const activity of activitiesToLog) {
            try {
                await logActivity(activity.appName, activity.exePath, activity.duration, activity.date, activity.type);
            }
            catch (err) {
                console.error('Error logging queued activity:', err);
            }
        }
    }, 30000);
}
function logDatabaseContents() {
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
