const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const net = require('net');
const fs = require('fs');

// Globals
let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 3001;
let serverStatus = {
  running: false,
  port: SERVER_PORT,
  ip: null,
  connectedDevices: 0,
  startTime: null,
  error: null,
  starting: false
};

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Check if port is available (returns true if in use)
function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, 'localhost');
  });
}

// Start the SwingCity server
async function startServer() {
  if (serverProcess || serverStatus.starting) return;
  try {
    serverStatus.starting = true;
    // Check if already running
    if (await checkPort(serverStatus.port)) {
      serverStatus.running = true;
      serverStatus.ip = getLocalIP();
      serverStatus.startTime = new Date();
      serverStatus.error = null;
      serverStatus.starting = false;
      updateStatusDisplay();
      return;
    }
    // Find server.js
    const serverPath = app.isPackaged
      ? path.join(process.resourcesPath)
      : path.resolve(__dirname, '..');
    const serverFile = path.join(serverPath, 'server.js');
    if (!fs.existsSync(serverFile)) throw new Error(`Server file not found at: ${serverFile}`);
    // Find Node.js
    let nodeCommand = process.execPath;
    if (app.isPackaged) {
      const possibleNodePaths = ['/usr/local/bin/node','/usr/bin/node','/opt/homebrew/bin/node','node'];
      nodeCommand = possibleNodePaths.find(nodePath => {
        try { require('child_process').execSync(`${nodePath} --version`, { stdio: 'ignore' }); return true; } catch { return false; }
      });
      if (!nodeCommand) throw new Error('Node.js not found on system. Please install Node.js to run SwingCity server.');
    }
    // Start server
    serverProcess = spawn(nodeCommand, [serverFile], {
      cwd: serverPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, NODE_ENV: 'production', PORT: String(SERVER_PORT), PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
    });
    serverStatus.running = true;
    serverStatus.ip = getLocalIP();
    serverStatus.startTime = new Date();
    serverStatus.error = null;
    serverStatus.starting = false;
    serverProcess.stdout.on('data', (data) => { console.log('Server output:', data.toString()); });
    serverProcess.stderr.on('data', (data) => { console.error('Server error:', data.toString()); serverStatus.error = data.toString(); updateStatusDisplay(); });
    serverProcess.on('error', (error) => {
      console.error('Failed to start server process:', error);
      serverStatus.error = `Failed to start: ${error.message}`;
      serverStatus.running = false;
      serverStatus.starting = false;
      serverProcess = null;
      updateStatusDisplay();
    });
    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      serverStatus.running = false;
      serverStatus.starting = false;
      serverStatus.error = code !== 0 ? `Process exited with code ${code}` : null;
      serverProcess = null;
      updateStatusDisplay();
    });
    setTimeout(updateStatusDisplay, 2000);
  } catch (error) {
    console.error('Failed to start server:', error);
    serverStatus.error = error.message;
    serverStatus.running = false;
    serverStatus.starting = false;
    updateStatusDisplay();
  }
}

// Stop the server
function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  serverStatus.running = false;
  serverStatus.startTime = null;
  updateStatusDisplay();
}

// Update status display in renderer
function updateStatusDisplay() {
  if (mainWindow) {
    mainWindow.webContents.send('status-update', serverStatus);
  }
}

// Monitor server status
setInterval(async () => {
  if (serverStatus.running) {
    const isActuallyRunning = await checkPort(serverStatus.port);
    if (!isActuallyRunning && serverProcess) {
      serverStatus.running = false;
      serverStatus.error = 'Server stopped unexpectedly';
      updateStatusDisplay();
    }
  }
}, 5000);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 320,
    resizable: false,
    maximizable: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#2d2d2d',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'public', 'images', 'swingcity-logo.png')
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.once('ready-to-show', () => { startServer(); });
}

// App event handlers
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('before-quit', () => { stopServer(); });

// IPC handlers
ipcMain.handle('get-status', () => serverStatus);
ipcMain.handle('start-server', () => startServer());
ipcMain.handle('stop-server', () => stopServer());
