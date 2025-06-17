"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabase = createDatabase;
exports.loadSettingsFromLocalStorage = loadSettingsFromLocalStorage;
exports.startActivityTracking = startActivityTracking;
exports.logDatabaseContents = logDatabaseContents;
// src/tracker.ts
const electron_1 = require("electron");
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const nut_js_1 = require("@nut-tree-fork/nut-js");
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
const db = new sqlite3_1.default.Database(path_1.default.join(__dirname, 'activity_tracker.db'));
let trackedApps = [];
let privacySettings = {
    trackWindowTitles: true,
    trackExecutablePaths: true
};
let lastLoggedDurations = new Map();
async function isProcessRunning(pid) {
    return new Promise(resolve => {
        if (os_1.default.platform() === 'win32') {
            (0, child_process_1.exec)(`tasklist /FI "PID eq ${pid}"`, (error, stdout, stderr) => {
                if (error || stderr) {
                    resolve(false);
                }
                else {
                    resolve(stdout.includes(pid.toString()));
                }
            });
        }
        else {
            (0, child_process_1.exec)(`ps -p ${pid}`, (error, stdout, stderr) => {
                const lines = stdout.trim().split('\n');
                resolve(lines.length > 1 && lines[1].includes(pid.toString()));
            });
        }
    });
}
async function createDatabase() {
    return new Promise((resolve, reject) => {
        db.run(`CREATE TABLE IF NOT EXISTS activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT,
                exe_path TEXT,
                duration INTEGER,
                date TEXT, -- Stores date in YYYY-MM-DD format
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
    console.log(`Logging DELTA: App=${appName}, Duration=${duration}ms, Type=${type}, Date=${date}`);
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO activity (app_name, exe_path, duration, date, type) VALUES (?, ?, ?, ?, ?)`, [appName, exePath, duration, date, type], function (err) {
            if (err) {
                console.error(`Error inserting activity for ${appName} (${type}):`, err);
                reject(err);
            }
            else {
                resolve({ id: this.lastID });
            }
        });
    });
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
    }).catch(err => {
        console.error('Error loading settings from local storage:', err);
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
    try {
        const mousePos = await nut_js_1.mouse.getPosition();
        const bounds = windowData.bounds;
        return (mousePos.x >= bounds.x &&
            mousePos.x <= bounds.x + bounds.width &&
            mousePos.y >= bounds.y &&
            mousePos.y <= bounds.y + bounds.height);
    }
    catch (error) {
        console.error("Error getting mouse position or window bounds:", error);
        return false;
    }
}
electron_1.ipcMain.on('update-settings', (event, newSettings) => {
    privacySettings = { ...privacySettings, ...newSettings };
    const mainWindow = electron_1.BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, privacySettings);
    }
});
electron_1.ipcMain.handle('log-activity', async (event, appName, exePath, duration, date, type) => {
    try {
        return await logActivity(appName, exePath, duration, date, type);
    }
    catch (err) {
        console.error('Failed to log activity via IPC:', err);
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
            ORDER BY totalOpenDuration DESC -- Added sorting here
        `, [], (err, rows) => {
            if (err) {
                console.error('Error fetching all app stats:', err);
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
});
electron_1.ipcMain.handle('get-available-dates', async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT DISTINCT date FROM activity ORDER BY date DESC`, [], (err, rows) => {
            if (err) {
                console.error('Error fetching distinct dates:', err);
                reject(err);
            }
            else {
                const dates = rows.map((row) => row.date);
                resolve(dates);
            }
        });
    });
});
electron_1.ipcMain.handle('get-daily-app-stats', async (event, date) => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT app_name AS name, exe_path AS exePath,
                   SUM(CASE WHEN type = 'open' THEN duration ELSE 0 END) AS totalOpenDuration,
                   SUM(CASE WHEN type = 'active' THEN duration ELSE 0 END) AS totalActiveDuration
            FROM activity
            WHERE date = ?
            GROUP BY exe_path
            ORDER BY totalOpenDuration DESC
        `, [date], (err, rows) => {
            if (err) {
                console.error(`Error fetching app stats for date ${date}:`, err);
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
    let activeWindow;
    let getAllWindows;
    try {
        const getWindowsModule = await (new Function('return import("get-windows")')());
        activeWindow = getWindowsModule.activeWindow;
        getAllWindows = getWindowsModule.getAllWindows;
        console.log('get-windows imported successfully.');
    }
    catch (error) {
        console.error('Failed to import get-windows. Activity tracking will be disabled.', error);
        return;
    }
    let lastTickTime = Date.now();
    const appStartupTime = Date.now();
    try {
        const allOpenWindows = await getAllWindows();
        const seenPids = new Set();
        for (const win of allOpenWindows) {
            if (win.owner && !seenPids.has(win.owner.processId)) {
                const { processId: pid, name, path: exePath } = win.owner;
                trackedApps.push({ name, exePath, pid, openStartTime: appStartupTime, totalOpenDuration: 0, totalActiveDuration: 0 });
                seenPids.add(pid);
                console.log(`Initially tracking app found on startup: ${name} (PID: ${pid})`);
            }
        }
    }
    catch (error) {
        console.error("Error during initial scan of open windows on startup:", error);
    }
    setInterval(async () => {
        try {
            const currentTime = Date.now();
            const deltaTime = currentTime - lastTickTime;
            lastTickTime = currentTime;
            const stillRunningApps = [];
            for (let i = 0; i < trackedApps.length; i++) {
                const app = trackedApps[i];
                const isRunning = await isProcessRunning(app.pid);
                if (isRunning) {
                    app.totalOpenDuration += deltaTime;
                    stillRunningApps.push(app);
                }
                else {
                    const lastLogged = lastLoggedDurations.get(app.exePath) || { open: 0, active: 0 };
                    const openDelta = app.totalOpenDuration - lastLogged.open;
                    const activeDelta = app.totalActiveDuration - lastLogged.active;
                    const date = new Date().toISOString().split('T')[0];
                    if (openDelta > 0) {
                        await logActivity(app.name, app.exePath, openDelta, date, 'open');
                    }
                    if (activeDelta > 0) {
                        await logActivity(app.name, app.exePath, activeDelta, date, 'active');
                    }
                    console.log(`App detected as closed: ${app.name} (PID: ${app.pid}). Logging final deltas.`);
                    lastLoggedDurations.delete(app.exePath);
                }
            }
            trackedApps = stillRunningApps;
            const activeWin = await activeWindow();
            if (activeWin && activeWin.owner) {
                const { processId: pid, name, path: exePath } = activeWin.owner;
                let app = trackedApps.find((a) => a.exePath === exePath);
                if (!app) {
                    app = { name, exePath, pid, openStartTime: currentTime, totalOpenDuration: 0, totalActiveDuration: 0 };
                    trackedApps.push(app);
                    console.log(`New active app detected: ${name} (PID: ${pid})`);
                }
                if (await isMouseInWindow(activeWin)) {
                    app.totalActiveDuration += deltaTime;
                }
            }
        }
        catch (error) {
            console.error("Error in main activity tracking interval (1s tick):", error);
        }
    }, 1000);
    setInterval(async () => {
        console.log('Periodically writing time deltas to database...');
        const date = new Date().toISOString().split('T')[0];
        for (const app of trackedApps) {
            const lastLogged = lastLoggedDurations.get(app.exePath) || { open: 0, active: 0 };
            const openDelta = app.totalOpenDuration - lastLogged.open;
            const activeDelta = app.totalActiveDuration - lastLogged.active;
            try {
                if (openDelta > 0) {
                    await logActivity(app.name, app.exePath, openDelta, date, 'open');
                }
                if (activeDelta > 0) {
                    await logActivity(app.name, app.exePath, activeDelta, date, 'active');
                }
                lastLoggedDurations.set(app.exePath, {
                    open: app.totalOpenDuration,
                    active: app.totalActiveDuration,
                });
            }
            catch (err) {
                console.error('Error writing periodic activity to database:', err);
            }
        }
    }, 30000);
}
function logDatabaseContents() {
    db.all(`SELECT * FROM activity`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching all data from database:', err);
            return;
        }
        console.log('\n--- Database Contents ---');
        rows.forEach((row) => {
            console.log(`ID: ${row.id}, App: ${row.app_name}, ExePath: ${row.exe_path}, Duration: ${row.duration}ms, Date: ${row.date}, Type: ${row.type}`);
        });
        console.log('-------------------------\n');
    });
}
