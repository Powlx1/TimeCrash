// src/main.ts
import { app, BrowserWindow, Tray, Menu, dialog } from 'electron';
import path from 'path';
import { __dirname } from './utils.js';
let isQuitting = false;
let tray = null;
export async function createWindow() {
    console.log('Main __dirname:', __dirname);
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('Preload path:', preloadPath);
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        show: false,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
    });
    await mainWindow.loadFile(path.join(__dirname, '../index.html'));
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
    return mainWindow;
}
export function createTray(mainWindow) {
    tray = new Tray(path.join(__dirname, 'icon.png')); // dist/icon.png
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                mainWindow.show();
            },
        },
        {
            label: 'Quit',
            click: () => {
                const choice = dialog.showMessageBoxSync(mainWindow, {
                    type: 'question',
                    buttons: ['Yes', 'No'],
                    title: 'Confirm Quit',
                    message: 'Are you sure you want to quit?',
                });
                if (choice === 0) {
                    isQuitting = true;
                    app.quit();
                }
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Activity Tracker');
    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.focus();
        }
        else {
            mainWindow.show();
        }
    });
}
