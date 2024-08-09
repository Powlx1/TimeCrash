var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// src/main.ts
import { app, BrowserWindow, Tray, Menu, dialog } from 'electron';
import path from 'path';
import { __dirname } from './utils.js';
let isQuitting = false;
export function createWindow() {
    return __awaiter(this, void 0, void 0, function* () {
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
        yield mainWindow.loadFile(path.join(__dirname, '../index.html'));
        mainWindow.on('ready-to-show', () => mainWindow.show());
        mainWindow.on('close', (event) => {
            if (!isQuitting) {
                event.preventDefault();
                mainWindow.hide();
            }
        });
        return mainWindow;
    });
}
export function createTray(mainWindow) {
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
        }
        else {
            mainWindow.show();
        }
    });
}
