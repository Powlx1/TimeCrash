var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// src/tracker.ts
import { ipcMain } from 'electron';
import sqlite3 from 'sqlite3';
import { activeWindow } from 'get-windows';
import path from 'path';
import { __dirname } from './utils.js';
const db = new sqlite3.Database(path.join(__dirname, 'activity_tracker.db'));
let currentApp;
let appUsage = [];
export function createDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        db.run(`CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT,
      duration INTEGER,
      date TEXT
    )`, (err) => {
            if (err) {
                console.error('Failed to create database:', err);
            }
        });
    });
}
function logActivity(appName, duration, date) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO activity (app_name, duration, date) VALUES (?, ?, ?)`, [appName, duration, date], function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve({ id: this.lastID });
            }
        });
    });
}
export function logDatabaseContents() {
    db.all(`SELECT * FROM activity`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching data from database:', err);
            return;
        }
        console.log('Database Contents:');
        rows.forEach((row) => {
            console.log(`ID: ${row.id}, App: ${row.app_name}, Duration: ${row.duration}ms, Date: ${row.date}`);
        });
    });
}
ipcMain.handle('log-activity', (event, appName, duration, date) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield logActivity(appName, duration, date);
        return result;
    }
    catch (err) {
        console.error('Failed to log activity:', err);
        throw err;
    }
}));
ipcMain.handle('get-app-usage', () => __awaiter(void 0, void 0, void 0, function* () {
    return appUsage;
}));
export function startActivityTracking(mainWindow) {
    return __awaiter(this, void 0, void 0, function* () {
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const activeWindowData = yield activeWindow();
                if (activeWindowData) {
                    const appName = activeWindowData.title;
                    if (currentApp && currentApp.name !== appName) {
                        const duration = Date.now() - currentApp.startTime;
                        const date = new Date().toISOString();
                        yield logActivity(currentApp.name, duration, date);
                        const existingApp = appUsage.find((app) => app.name === currentApp.name);
                        if (existingApp) {
                            existingApp.duration += duration;
                        }
                        else {
                            appUsage.push({ name: currentApp.name, duration });
                        }
                        currentApp = { name: appName, startTime: Date.now() };
                    }
                    else if (!currentApp) {
                        currentApp = { name: appName, startTime: Date.now() };
                    }
                }
            }
            catch (error) {
                console.error('Failed to track activity:', error);
            }
        }), 1000);
    });
}
