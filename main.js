const { app, BrowserWindow } = require('electron')
const reload = require('electron-reload')
const path = require('path')
function createWindow() {

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  win.loadFile('index.html').then(function () {
    win.removeMenu();
    win.maximize();
    win.show();
    win.webContents.openDevTools();

  });

}

app.allowRendererProcessReuse = false;
app.whenReady().then(createWindow)
