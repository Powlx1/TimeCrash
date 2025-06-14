import { ipcMain, BrowserWindow } from 'electron';
import sqlite3 from 'sqlite3';
import path from 'path';
import { mouse } from '@nut-tree-fork/nut-js';

const db = new sqlite3.Database(path.join(__dirname, 'activity_tracker.db'));

interface TrackedApp {
    name: string;
    exePath: string;
    pid: number;
    openStartTime: number;
    activeStartTime?: number;
    totalOpenDuration: number;
    totalActiveDuration: number;
}

let trackedApps: TrackedApp[] = [];
let privacySettings = {
    trackWindowTitles: true,
    trackExecutablePaths: true
};

let lastLoggedDurations = new Map<string, { open: number, active: number }>();

export async function createDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
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
                    console.error('Failed to create database:', err);
                    reject(err);
                } else {
                    console.log('Database table created or already exists');
                    resolve();
                }
            }
        );
    });
}

function logActivity(appName: string, exePath: string, duration: number, date: string, type: 'open' | 'active'): Promise<{ id: number }> {
    console.log(`Logging DELTA: App=${appName}, Duration=${duration}ms, Type=${type}`);
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO activity (app_name, exe_path, duration, date, type) VALUES (?, ?, ?, ?, ?)`,
            [appName, exePath, duration, date, type],
            function (err) {
                if (err) {
                    reject(err);
                } else {
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

async function isMouseInWindow(windowData: any): Promise<boolean> {
    const mousePos = await mouse.getPosition();
    const bounds = windowData.bounds;
    return (
        mousePos.x >= bounds.x &&
        mousePos.x <= bounds.x + bounds.width &&
        mousePos.y >= bounds.y &&
        mousePos.y <= bounds.y + bounds.height
    );
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
        console.error('Failed to log activity:', err);
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
        `, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
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
    try {
        const getWindowsModule = await (new Function('return import("get-windows")')());
        activeWindow = getWindowsModule.activeWindow;
        console.log('get-windows imported successfully.');
    } catch (error) {
        console.error('Failed to import get-windows. Activity tracking will be disabled.', error);
        return;
    }

    let lastTickTime = Date.now();

    setInterval(async () => {
        try {
            const currentTime = Date.now();
            const deltaTime = currentTime - lastTickTime;
            lastTickTime = currentTime;

            const activeWin = await activeWindow();

            for(const app of trackedApps) {
                app.totalOpenDuration += deltaTime;
            }

            if (activeWin && activeWin.owner) {
                const { processId: pid, name, path: exePath } = activeWin.owner;
                
                let app = trackedApps.find((a) => a.exePath === exePath);

                if (!app) {
                    app = { name, exePath, pid, openStartTime: currentTime, totalOpenDuration: 0, totalActiveDuration: 0 };
                    trackedApps.push(app);
                    console.log(`New app opened: ${name}`);
                }
                
                if (await isMouseInWindow(activeWin)) {
                    app.totalActiveDuration += deltaTime;
                }
            }
        } catch (error) {
        }
    }, 1000);

    setInterval(async () => {
        console.log('Writing time deltas to database...');
        for (const app of trackedApps) {
            const lastLogged = lastLoggedDurations.get(app.exePath) || { open: 0, active: 0 };

            const openDelta = app.totalOpenDuration - lastLogged.open;
            const activeDelta = app.totalActiveDuration - lastLogged.active;
            
            const date = new Date().toISOString();

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
                console.error('Error writing activity to database:', err);
            }
        }
    }, 30000);
}


export function logDatabaseContents(): void {
    db.all(`SELECT * FROM activity`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching data from database:', err);
            return;
        }
        console.log('Database Contents:');
        rows.forEach((row: any) => {
            console.log(`ID: ${row.id}, App: ${row.app_name}, ExePath: ${row.exe_path}, Duration: ${row.duration}ms, Date: ${row.date}, Type: ${row.type}`);
        });
    });
}
