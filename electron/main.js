const path = require('path');
const { app, BrowserWindow, protocol } = require('electron');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';


// If you want to support opening file:// URLs from the renderer, you may extend this.
// For now we only load the local Vite build (dist).

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    backgroundColor: '#04060f',
    webPreferences: {
      // Security: keep Node out of the renderer.
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const devServerURL = process.env.ELECTRON_DEV_SERVER_URL;
  if (devServerURL) {
    mainWindow.loadURL(devServerURL);
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexHtml);
  }
}

app.whenReady().then(async () => {
  // Required on macOS for some packaging configurations.
  // (Keeps it safe even if unused.)
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true } },
  ]).catch(() => {});

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Quit on Windows/Linux; keep running on macOS until explicit quit.
  if (process.platform !== 'darwin') app.quit();
});

