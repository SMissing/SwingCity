// Renderer process script
let statusUpdateInterval;

// DOM elements
const serverStatus = document.getElementById('server-status');
const connectedDevices = document.getElementById('connected-devices');
const serverUrl = document.getElementById('server-url');
const serverLight = document.getElementById('server-light');
const serverLightText = document.getElementById('server-light-text');
const networkLight = document.getElementById('network-light');
const uptime = document.getElementById('uptime');
const errorMessage = document.getElementById('error-message');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

// Renderer process script
// DOM elements
const serverStatus = document.getElementById('server-status');
const connectedDevices = document.getElementById('connected-devices');
const serverUrl = document.getElementById('server-url');
const serverLight = document.getElementById('server-light');
const serverLightText = document.getElementById('server-light-text');
const networkLight = document.getElementById('network-light');
const uptime = document.getElementById('uptime');
const errorMessage = document.getElementById('error-message');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

function formatUptime(startTime) {
    if (!startTime) return '';
    const now = new Date();
    const diff = now - new Date(startTime);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `Uptime: ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `Uptime: ${minutes}m ${seconds % 60}s`;
    return `Uptime: ${seconds}s`;
}

function updateUI(status) {
    // Server status
    if (status.running) {
        serverStatus.textContent = 'Running';
        serverStatus.style.color = '#4CAF50';
        serverLight.className = 'status-light green';
        serverLightText.textContent = 'Server';
        networkLight.className = 'status-light green';
    } else {
        serverStatus.textContent = 'Stopped';
        serverStatus.style.color = '#f44336';
        serverLight.className = 'status-light red';
        serverLightText.textContent = 'Server';
        networkLight.className = 'status-light grey';
    }
    // Server URL
    if (status.running && status.ip) {
        serverUrl.textContent = `http://${status.ip}:${status.port}`;
        serverUrl.style.color = '#4CAF50';
    } else {
        serverUrl.textContent = 'Server not running';
        serverUrl.style.color = '#888';
    }
    // Uptime
    uptime.textContent = status.running ? formatUptime(status.startTime) : '';
    // Error
    errorMessage.textContent = status.error ? status.error : '';
    // Buttons
    startBtn.disabled = status.running || status.starting;
    stopBtn.disabled = !status.running;
}

// Button events
startBtn.addEventListener('click', () => {
    window.electronAPI.startServer();
});
stopBtn.addEventListener('click', () => {
    window.electronAPI.stopServer();
});

// Initial status fetch
window.electronAPI.getStatus().then(updateUI);

// Listen for status updates
window.electronAPI.onStatusUpdate(updateUI);
        errorMessage.classList.add('hidden');
    }

    // Update button states
    if (status.starting) {
        startBtn.disabled = true;
        stopBtn.disabled = true;
        startBtn.textContent = 'Starting...';
    } else if (status.running) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        startBtn.textContent = 'Start Server';
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        startBtn.textContent = 'Start Server';
    }

    // Add pulse effect to lights when starting
    if (status.running && !status.startTime) {
        serverLight.classList.add('pulse');
        setTimeout(() => {
            serverLight.classList.remove('pulse');
        }, 3000);
    }
}

// Button event handlers
async function handleStartServer() {
    try {
        startBtn.disabled = true;
        startBtn.textContent = 'Starting...';
        await window.electronAPI.startServer();
    } catch (error) {
        console.error('Failed to start server:', error);
        startBtn.disabled = false;
        startBtn.textContent = 'Start Server';
    }
}

async function handleStopServer() {
    try {
        stopBtn.disabled = true;
        await window.electronAPI.stopServer();
        // UI will update via status update event
    } catch (error) {
        console.error('Failed to stop server:', error);
        stopBtn.disabled = false;
    }
}

// Initialize the app
async function init() {
    try {
        // Get initial status
        const status = await window.electronAPI.getStatus();
        updateUI(status);

        // Listen for status updates
        window.electronAPI.onStatusUpdate((event, status) => {
            updateUI(status);
        });

        // Add button event listeners
        startBtn.addEventListener('click', handleStartServer);
        stopBtn.addEventListener('click', handleStopServer);

        // Update uptime every second
        statusUpdateInterval = setInterval(async () => {
            const currentStatus = await window.electronAPI.getStatus();
            if (currentStatus.startTime) {
                uptime.textContent = formatUptime(currentStatus.startTime);
            }
        }, 1000);

    } catch (error) {
        console.error('Failed to initialize:', error);
        serverStatus.textContent = 'Error';
        serverStatus.style.color = '#f44336';
        serverLight.className = 'status-light red';
        errorMessage.textContent = 'Failed to initialize launcher';
        errorMessage.classList.remove('hidden');
    }
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Clean up on unload
window.addEventListener('beforeunload', () => {
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }
});
