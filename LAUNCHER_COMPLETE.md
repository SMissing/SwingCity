# SwingCity V2 Desktop Launcher

A beautiful, cross-platform desktop launcher for your SwingCity V2 server that provides real-time monitoring and one-click server management.

## Features

✨ **Game Launcher Sized Window** - Compact, non-intrusive interface  
🎨 **Dark Grey Theme** - Modern, professional appearance  
🚦 **Status Indicators** - Green/Amber/Red lights for quick health checks  
📡 **Real-time Monitoring** - Live server status, IP address, and port information  
⏱️ **Uptime Tracking** - See how long your server has been running  
🔧 **Auto-start Server** - Automatically launches your npm server  
🌐 **Cross-platform** - Works on both Mac and Windows  
📱 **Connected Device Count** - Monitor how many devices are connected  
⚠️ **Error Display** - Quick troubleshooting with error messages  

## Quick Start

### Running the Launcher (Development)
```bash
npm run launcher
```

### Building for Distribution
```bash
npm run dist
```

## What You'll See

The launcher opens a **400x280 pixel window** with:

- **Server Status**: Shows if the server is running (green) or stopped (red)
- **Server URL**: Displays the full HTTP address (e.g., `http://192.168.1.100:3001`)
- **Status Lights**: 
  - 🟢 Green = Everything running smoothly
  - 🟠 Amber = Starting up or warning
  - 🔴 Red = Error or stopped
- **Connected Devices**: Count of active connections
- **Uptime**: How long the server has been running
- **Error Messages**: Any issues that need attention

## How It Works

1. **Auto-Launch**: When you open the launcher, it automatically starts your SwingCity server using `npm start`
2. **Health Monitoring**: Continuously checks if the server is responding on port 3001
3. **Network Detection**: Automatically detects and displays your local IP address
4. **Clean Shutdown**: Properly stops the server when you close the launcher

## File Structure

```
launcher/
├── main.js          # Electron main process (server management)
├── preload.js       # Security bridge between main and renderer
├── renderer.html    # UI layout and styling
└── renderer.js      # UI logic and status updates
```

## Distribution

### Mac (.dmg)
```bash
npm run build-launcher
# Creates: dist/SwingCity V2 Launcher-1.0.0.dmg
```

### Windows (.exe)
```bash
npm run build-launcher
# Creates: dist/SwingCity V2 Launcher Setup 1.0.0.exe
```

### Linux (AppImage)
```bash
npm run build-launcher
# Creates: dist/SwingCity V2 Launcher-1.0.0.AppImage
```

## For Your Staff

**Perfect for non-technical users!**

1. Double-click the launcher app on desktop
2. Window opens showing green lights = everything is working
3. The IP address is clearly displayed for device connections
4. Red lights = call for help
5. Close the window to stop everything cleanly

No terminal commands, no code visibility, just a simple status dashboard!

## Customization

You can easily modify:
- **Window size**: Edit `width` and `height` in `launcher/main.js`
- **Colors**: Modify CSS variables in `renderer.html`
- **Port**: Change `serverStatus.port` in `main.js`
- **Logo**: Replace the icon path in `main.js`

## Troubleshooting

**Launcher won't start server:**
- Check that `npm start` works from terminal first
- Ensure port 3001 isn't already in use

**Red lights showing:**
- Check the error message at the bottom of the window
- Verify network connectivity
- Restart the launcher

**Can't build for distribution:**
- Make sure `electron-builder` is installed: `npm install --save-dev electron-builder`
- Check that all dependencies are installed: `npm install`

---

Perfect for your crazy golf setup! Your staff can now manage the server with confidence, and you get a professional-looking launcher that works across platforms. 🏌️‍♂️⭐