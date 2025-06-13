"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWindow = createWindow;
exports.createTray = createTray;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let isQuitting = false;
let tray = null;
async function createWindow() {
    console.log('Main __dirname:', __dirname);
    const preloadPath = path_1.default.join(__dirname, 'preload.js');
    console.log('!!! Preload script executing !!!');
    console.log('Preload path:', preloadPath);
    console.log("Resolved preload path:", preloadPath, "Exists?", fs_1.default.existsSync(preloadPath));
    const mainWindow = new electron_1.BrowserWindow({
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
    await mainWindow.loadFile(path_1.default.join(__dirname, '../index.html'));
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
    return mainWindow;
}
function createTray(mainWindow) {
    const iconPath = path_1.default.join(__dirname, 'icon.png');
    if (!fs_1.default.existsSync(iconPath)) {
        console.warn(`Tray icon not found at ${iconPath}, skipping tray creation`);
        return;
    }
    tray = new electron_1.Tray(iconPath);
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Show App',
            click: () => {
                mainWindow.show();
            },
        },
        {
            label: 'Quit',
            click: () => {
                const choice = electron_1.dialog.showMessageBoxSync(mainWindow, {
                    type: 'question',
                    buttons: ['Yes', 'No'],
                    title: 'Confirm Quit',
                    message: 'Are you sure you want to quit?',
                });
                if (choice === 0) {
                    isQuitting = true;
                    electron_1.app.quit();
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
