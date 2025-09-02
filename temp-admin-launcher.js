const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;

function createWindow() {
  // Create a simple browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, '..', 'public', 'images', 'swingcity-logo.png')
  });

  // Start the server first
  startServer();

  // Wait a moment then load the admin page
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3001/admin');
  }, 3000);

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopServer();
  });
}

function startServer() {
  if (serverProcess) return;
  
  console.log('Starting SwingCity server...');
  
  const projectRoot = path.resolve(__dirname);
  console.log('Project root:', projectRoot);
  
  serverProcess = spawn('npm', ['start'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true
  });

  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopServer();
});
