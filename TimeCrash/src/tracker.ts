import { ipcMain, BrowserWindow } from 'electron';
import sqlite3 from 'sqlite3';
import path from 'path';
import { mouse } from '@nut-tree-fork/nut-js';
import { exec } from 'child_process';
import os from 'os';

interface TrackedApp {
    name: string;
    exePath: string;
    pid: number;
    openStartTime: number;
    activeStartTime?: number;
    totalOpenDuration: number;
    totalActiveDuration: number;
    lastActiveTime?: number; 
}

const db = new sqlite3.Database(path.join(__dirname, 'activity_tracker.db'));
let trackedApps: TrackedApp[] = [];
let privacySettings = {
    trackWindowTitles: true,
    trackExecutablePaths: true
};
let lastLoggedDurations = new Map<string, { open: number, active: number }>();
let lastLoggedCoUsages = new Map<string, { duration: number }>();
const activeTimeWindow = 30000; 
const trackedPairs = new Set<string>(); 

async function isProcessRunning(pid: number): Promise<boolean> {
    return new Promise(resolve => {
        if (os.platform() === 'win32') {
            exec(`tasklist /FI "PID eq ${pid}"`, (error, stdout, stderr) => {
                if (error || stderr) {
                    resolve(false);
                } else {
                    resolve(stdout.includes(pid.toString()));
                }
            });
        } else {
            exec(`ps -p ${pid}`, (error, stdout, stderr) => {
                const lines = stdout.trim().split('\n');
                resolve(lines.length > 1 && lines[1].includes(pid.toString()));
            });
        }
    });
}

export async function createDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(
                `CREATE TABLE IF NOT EXISTS activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    app_name TEXT,
                    exe_path TEXT,
                    duration INTEGER,
                    date TEXT,
                    type TEXT
                )`,
                (err) => {
                    if (err) {
                        console.error('Failed to create activity table:', err);
                        reject(err);
                    }
                }
            );
            db.run(
                `CREATE TABLE IF NOT EXISTS app_co_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    app1_name TEXT,
                    app1_exePath TEXT,
                    app2_name TEXT,
                    app2_exePath TEXT,
                    co_usage_duration INTEGER,
                    date TEXT
                )`,
                (err) => {
                    if (err) {
                        console.error('Failed to create app_co_usage table:', err);
                        reject(err);
                    } else {
                        console.log('Database tables created or already exist');
                        resolve();
                    }
                }
            );
        });
    });
}

function logActivity(appName: string, exePath: string, duration: number, date: string, type: 'open' | 'active'): Promise<{ id: number }> {
    console.log(`Logging DELTA: App=${appName}, Duration=${duration}ms, Type=${type}, Date=${date}`);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO activity (app_name, exe_path, duration, date, type) VALUES (?, ?, ?, ?, ?)`,
            [appName, exePath, duration, date, type],
            function (err) {
                if (err) {
                    console.error(`Error inserting activity for ${appName} (${type}):`, err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            }
        );
    });
}

function logCoUsage(app1: TrackedApp, app2: TrackedApp, duration: number, date: string): Promise<{ id: number }> {
    const key = `${app1.exePath}|${app2.exePath}` < `${app2.exePath}|${app1.exePath}` 
        ? `${app1.exePath}|${app2.exePath}` 
        : `${app2.exePath}|${app1.exePath}`;
    if (!trackedPairs.has(key)) {
        console.log(`New co-usage pair detected: ${app1.name} & ${app2.name}`);
        trackedPairs.add(key);
    }
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO app_co_usage (app1_name, app1_exePath, app2_name, app2_exePath, co_usage_duration, date) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [app1.name, app1.exePath, app2.name, app2.exePath, duration, date],
            function (err) {
                if (err) {
                    console.error(`Error inserting co-usage for ${app1.name} & ${app2.name}:`, err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            }
        );
    });
}

export function cleanLowDurationCoUsages(): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM app_co_usage WHERE co_usage_duration < 10000`, 
            (err) => {
                if (err) {
                    console.error('Failed to clean low-duration co-usages:', err);
                    reject(err);
                } else {
                    console.log('Cleaned low-duration co-usage entries');
                    resolve();
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
    }).catch(err => {
        console.error('Error loading settings from local storage:', err);
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

async function isMouseInWindow(windowData: any): Promise<boolean> {
    try {
        const mousePos = await mouse.getPosition();
        const bounds = windowData.bounds;
        return (
            mousePos.x >= bounds.x &&
            mousePos.x <= bounds.x + bounds.width &&
            mousePos.y >= bounds.y &&
            mousePos.y <= bounds.y + bounds.height
        );
    } catch (error) {
        console.error("Error getting mouse position or window bounds:", error);
        return false;
    }
}

ipcMain.on('update-settings', (event, newSettings: { trackWindowTitles: boolean, trackExecutablePaths: boolean }) => {
    privacySettings = { ...privacySettings, ...newSettings };
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, privacySettings);
    }
});

ipcMain.handle('log-activity', async (event, appName: string, exePath: string, duration: number, date: string, type: 'open' | 'active') => {
    try {
        return await logActivity(appName, exePath, duration, date, type);
    } catch (err) {
        console.error('Failed to log activity via IPC:', err);
        throw err;
    }
});

ipcMain.handle('get-app-stats', async () => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT app_name AS name, exe_path AS exePath,
                   SUM(CASE WHEN type = 'open' THEN duration ELSE 0 END) AS totalOpenDuration,
                   SUM(CASE WHEN type = 'active' THEN duration ELSE 0 END) AS totalActiveDuration
            FROM activity
            GROUP BY exe_path
            ORDER BY totalOpenDuration DESC
        `, [], (err, rows) => {
            if (err) {
                console.error('Error fetching all app stats:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
});

ipcMain.handle('get-available-dates', async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT DISTINCT date FROM activity ORDER BY date DESC`, [], (err, rows: { date: string }[]) => {
            if (err) {
                console.error('Error fetching distinct dates:', err);
                reject(err);
            } else {
                const dates = rows.map((row) => row.date);
                resolve(dates);
            }
        });
    });
});

ipcMain.handle('get-daily-app-stats', async (event, date: string) => {
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
            } else {
                resolve(rows);
            }
        });
    });
});

ipcMain.handle('get-co-usage-stats', async (event, date: string) => {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT app1_name, app1_exePath, app2_name, app2_exePath,
                   SUM(co_usage_duration) AS co_usage_duration,
                   date
            FROM app_co_usage
            WHERE date = ?
            GROUP BY app1_exePath, app2_exePath
            ORDER BY co_usage_duration DESC
            LIMIT 5
        `, [date], (err, rows) => {
            if (err) {
                console.error(`Error fetching co-usage stats for date ${date}:`, err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
});

ipcMain.handle('clean-co-usage', async () => {
    try {
        await cleanLowDurationCoUsages();
        console.log('Low-duration co-usage entries cleaned via IPC');
    } catch (err) {
        console.error('Failed to clean co-usage entries via IPC:', err);
        throw err;
    }
});

ipcMain.handle('get-settings', async () => {
    return privacySettings;
});

ipcMain.handle('save-settings', async (event, settings: { trackWindowTitles: boolean, trackExecutablePaths: boolean }) => {
    privacySettings = settings;
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        saveSettingsToLocalStorage(mainWindow, settings);
    }
});

export async function startActivityTracking(mainWindow: BrowserWindow): Promise<void> {
    let activeWindow;
    let getAllWindows;
    try {
        const getWindowsModule = await (new Function('return import("get-windows")')());
        activeWindow = getWindowsModule.activeWindow;
        getAllWindows = getWindowsModule.getAllWindows;
        console.log('get-windows imported successfully.');
    } catch (error) {
        console.error('Failed to import get-windows. Activity tracking will be disabled.', error);
        return;
    }

    let lastTickTime = Date.now();

    const appStartupTime = Date.now();
    try {
        const allOpenWindows = await getAllWindows();
        const seenPids = new Set<number>();
        for (const win of allOpenWindows) {
            if (win.owner && !seenPids.has(win.owner.processId)) {
                const { processId: pid, name, path: exePath } = win.owner;
                trackedApps.push({ name, exePath, pid, openStartTime: appStartupTime, totalOpenDuration: 0, totalActiveDuration: 0 });
                seenPids.add(pid);
                console.log(`Initially tracking app found on startup: ${name} (PID: ${pid})`);
            }
        }
    } catch (error) {
        console.error("Error during initial scan of open windows on startup:", error);
    }

    setInterval(async () => {
        try {
            const currentTime = Date.now();
            const deltaTime = currentTime - lastTickTime;
            lastTickTime = currentTime;

            const stillRunningApps: TrackedApp[] = [];
            for (let i = 0; i < trackedApps.length; i++) {
                const app = trackedApps[i];
                const isRunning = await isProcessRunning(app.pid);

                if (isRunning) {
                    app.totalOpenDuration += deltaTime;
                    stillRunningApps.push(app);
                } else {
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
                    for (const key of trackedPairs) {
                        if (key.includes(app.exePath)) {
                            trackedPairs.delete(key);
                        }
                    }
                }
            }
            trackedApps = stillRunningApps;

            const activeWin = await activeWindow();
            let currentActiveApp: TrackedApp | null = null;

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
                    app.lastActiveTime = currentTime;
                    currentActiveApp = app;
                }
            }

            const date = new Date().toISOString().split('T')[0];
            for (let i = 0; i < stillRunningApps.length; i++) {
                const app1 = stillRunningApps[i];
                if (!app1.lastActiveTime || (currentTime - app1.lastActiveTime) > activeTimeWindow) continue;

                for (let j = i + 1; j < stillRunningApps.length; j++) {
                    const app2 = stillRunningApps[j];
                    if (!app2.lastActiveTime || (currentTime - app2.lastActiveTime) > activeTimeWindow) continue;

                    if (app1 === currentActiveApp || app2 === currentActiveApp) {
                        const key = `${app1.exePath}|${app2.exePath}` < `${app2.exePath}|${app1.exePath}` 
                            ? `${app1.exePath}|${app2.exePath}` 
                            : `${app2.exePath}|${app1.exePath}`;
                        const lastLogged = lastLoggedCoUsages.get(key) || { duration: 0 };
                        const coUsageDelta = deltaTime;

                        if (coUsageDelta > 0) {
                            await logCoUsage(app1, app2, coUsageDelta, date);
                            lastLoggedCoUsages.set(key, { duration: lastLogged.duration + coUsageDelta });
                        }
                    }
                }
            }
        } catch (error) {
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
            } catch (err) {
                console.error('Error writing periodic activity to database:', err);
            }
        }

        for (const [key, { duration }] of lastLoggedCoUsages.entries()) {
            if (duration > 0) {
                const [exePath1, exePath2] = key.split('|');
                const app1 = trackedApps.find(app => app.exePath === exePath1);
                const app2 = trackedApps.find(app => app.exePath === exePath2);
                if (app1 && app2) {
                    await logCoUsage(app1, app2, duration, date);
                    lastLoggedCoUsages.set(key, { duration: 0 });
                }
            }
        }
    }, 30000);
}

export function logDatabaseContents(): void {
    db.all(`SELECT * FROM activity`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching all data from activity table:', err);
            return;
        }
        console.log('\n--- Activity Table Contents ---');
        rows.forEach((row: any) => {
            console.log(`ID: ${row.id}, App: ${row.app_name}, ExePath: ${row.exe_path}, Duration: ${row.duration}ms, Date: ${row.date}, Type: ${row.type}`);
        });
        console.log('-------------------------\n');
    });
    db.all(`SELECT * FROM app_co_usage`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching all data from app_co_usage table:', err);
            return;
        }
        console.log('\n--- App Co-Usage Table Contents ---');
        rows.forEach((row: any) => {
            console.log(`ID: ${row.id}, App1: ${row.app1_name}, App2: ${row.app2_name}, Duration: ${row.co_usage_duration}ms, Date: ${row.date}`);
        });
        console.log('-------------------------\n');
    });
}