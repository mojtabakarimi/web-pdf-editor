const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// Auto-reload in development
try {
  require('electron-reloader')(module, {
    watchRenderer: true
  });
} catch {}

// Allow running as root on Linux (adds --no-sandbox if needed)
if (process.platform === 'linux' && process.getuid && process.getuid() === 0) {
  app.commandLine.appendSwitch('no-sandbox');
}

// Development: auto-load this PDF on startup (set to null for production)
const DEV_AUTO_LOAD_PDF = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // Disabled - uncomment for debugging

  // Auto-load PDF for development
  mainWindow.webContents.on('did-finish-load', () => {
    if (DEV_AUTO_LOAD_PDF) {
      mainWindow.webContents.send('load-pdf', DEV_AUTO_LOAD_PDF);
    }
  });
}

// Handle file selection
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handle save file dialog
ipcMain.handle('dialog:saveFile', async (event, defaultPath) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultPath,
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    return result.filePath;
  }
  return null;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
