const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const net = require('net');
const fs = require('fs');

// Global references
let mainWindow = null;
let serverApp = null;
let serverStatus = {
  running: false,
  port: 3001,
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
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

// Check if port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true); // Port is in use
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false); // Port is not in use
    });
    
    socket.on('error', () => {
      resolve(false); // Port is not in use
    });
    
    socket.connect(port, 'localhost');
  });
}

// Start the SwingCity server directly in the main process
async function startServer() {
  if (serverApp) {
    console.log('Server already running');
    return;
  }

  if (serverStatus.starting) {
    console.log('Server already starting, please wait...');
    return;
  }

  try {
    serverStatus.starting = true;
    
    // Check if server is already running
    const isRunning = await checkPort(serverStatus.port);
    if (isRunning) {
      serverStatus.running = true;
      serverStatus.ip = getLocalIP();
      serverStatus.startTime = new Date();
      serverStatus.error = null;
      serverStatus.starting = false;
      updateStatusDisplay();
      return;
    }

    console.log('Starting SwingCity server in main process...');
    
    // Determine the correct path to server files
    let serverPath;
    if (app.isPackaged) {
      serverPath = path.join(process.resourcesPath);
    } else {
      serverPath = path.resolve(__dirname, '..');
    }
    
    console.log('Server path:', serverPath);
    
    // Change working directory to server path
    process.chdir(serverPath);
    
    // Load and start the server module directly
    const serverFile = path.join(serverPath, 'server.js');
    
    if (!fs.existsSync(serverFile)) {
      throw new Error(`Server file not found at: ${serverFile}`);
    }
    
    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.PORT = '3001';
    
    // Require and start the server
    delete require.cache[serverFile]; // Clear cache in case of restart
    const serverModule = require(serverFile);
    
    // Store the server instance for later cleanup
    if (serverModule && serverModule.server) {
      global.swingCityServer = serverModule.server;
    }
    
    serverStatus.running = true;
    serverStatus.ip = getLocalIP();
    serverStatus.startTime = new Date();
    serverStatus.error = null;
    serverStatus.starting = false;
    serverApp = serverModule; // Store the module reference
    
    updateStatusDisplay();
    
    console.log('Server started successfully in main process');

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
  if (serverApp) {
    try {
      // Since the server is running in the same process, we need to find a way to stop it
      // We'll try to close any HTTP servers that might be running
      const http = require('http');
      
      // Try to gracefully close any servers
      if (global.swingCityServer) {
        global.swingCityServer.close(() => {
          console.log('Server closed gracefully');
        });
      }
      
      serverApp = null;
    } catch (error) {
      console.error('Error stopping server:', error);
    }
  }
  
  serverStatus.running = false;
  serverStatus.startTime = null;
  serverStatus.error = null;
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
    if (!isActuallyRunning && serverApp) {
      serverStatus.running = false;
      serverStatus.error = 'Server stopped unexpectedly';
      updateStatusDisplay();
    }
  }
}, 5000);

function createWindow() {
  // Create the browser window
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

  // Load the HTML file
  mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Start server automatically when window is ready
  mainWindow.once('ready-to-show', () => {
    startServer();
  });
}

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopServer();
});

// IPC handlers
ipcMain.handle('get-status', () => {
  return serverStatus;
});

ipcMain.handle('start-server', () => {
  startServer();
});

ipcMain.handle('stop-server', () => {
  stopServer();
});
