// src/tracker.ts
import { ipcMain, BrowserWindow } from 'electron';
import sqlite3 from 'sqlite3';
import { activeWindow } from 'get-windows';
import path from 'path';
import { __dirname } from './utils.js';

const db = new sqlite3.Database(path.join(__dirname, 'activity_tracker.db'));

let currentApp: { name: string; startTime: number };
let appUsage: { name: string; duration: number }[] = [];

export async function createDatabase(): Promise<void> {
  db.run(
    `CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name TEXT,
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

function logActivity(appName: string, duration: number, date: string): Promise<{ id: number }> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO activity (app_name, duration, date) VALUES (?, ?, ?)`,
      [appName, duration, date],
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


export function logDatabaseContents(): void {
  db.all(`SELECT * FROM activity`, [], (err, rows: { id: number; app_name: string; duration: number; date: string }[]) => {
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


ipcMain.handle('log-activity', async (event, appName: string, duration: number, date: string) => {
  try {
    const result = await logActivity(appName, duration, date);
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
  setInterval(async () => {
    try {
      const activeWindowData = await activeWindow();
      if (activeWindowData) {
        const appName = activeWindowData.title;

        if (currentApp && currentApp.name !== appName) {
          const duration = Date.now() - currentApp.startTime;
          const date = new Date().toISOString();
          await logActivity(currentApp.name, duration, date);

          const existingApp = appUsage.find((app) => app.name === currentApp.name);
          if (existingApp) {
            existingApp.duration += duration;
          } else {
            appUsage.push({ name: currentApp.name, duration });
          }

          currentApp = { name: appName, startTime: Date.now() };
        } else if (!currentApp) {
          currentApp = { name: appName, startTime: Date.now() };
        }
      }
    } catch (error) {
      console.error('Failed to track activity:', error);
    }
  }, 1000);
}
