// src/main.ts
import { app, BrowserWindow, Tray, Menu, dialog } from 'electron';
import path from 'path';
import { __dirname } from './utils.js';

let isQuitting = false;

export async function createWindow(): Promise<BrowserWindow> {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  await mainWindow.loadFile(path.join(__dirname, '../index.html'));
  mainWindow.on('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

export function createTray(mainWindow: BrowserWindow): void {
  const tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
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
    } else {
      mainWindow.show();
    }
  });
}
