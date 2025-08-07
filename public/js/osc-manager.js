// OSC Manager JavaScript
let logPaused = false;
let currentEditHole = null;
let socket = null;

// Initialize the OSC manager
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupWebSocket();
    loadStatus();
    loadNetworkInfo();
    loadRoutingTable();
    loadOSCLog();
    
    // Auto-refresh status every 5 seconds
    setInterval(loadStatus, 5000);
});

function setupWebSocket() {
    // Initialize Socket.IO connection
    socket = io();
    
    // Subscribe to OSC log updates
    socket.emit('subscribe-osc-log');
    
    // Handle real-time OSC messages
    socket.on('osc-message', function(logEntry) {
        if (!logPaused) {
            addLogEntryToDisplay(logEntry);
        }
    });
    
    // Handle log cleared event
    socket.on('osc-log-cleared', function() {
        clearLogDisplay();
    });
    
    socket.on('disconnect', function() {
        console.log('WebSocket disconnected');
    });
    
    socket.on('connect', function() {
        console.log('WebSocket connected');
        socket.emit('subscribe-osc-log');
    });
}

function setupEventListeners() {
    // Control buttons
    document.getElementById('startOscBtn').addEventListener('click', startOSCRouter);
    document.getElementById('restartOscBtn').addEventListener('click', restartOSCRouter);
    document.getElementById('stopOscBtn').addEventListener('click', stopOSCRouter);
    
    // Status refresh
    document.getElementById('refreshStatusBtn').addEventListener('click', function() {
        loadStatus();
        loadNetworkInfo();
        loadRoutingTable();
    });
    
    // Log controls
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    document.getElementById('pauseLogBtn').addEventListener('click', toggleLogPause);
    
    // Save routing changes
    document.getElementById('saveRoutingBtn').addEventListener('click', saveRoutingChanges);
}

async function loadStatus() {
    try {
        const response = await fetch('/api/osc/status');
        const data = await response.json();
        
        if (response.ok && data.success) {
            updateStatusDisplay(data.status);
        } else {
            throw new Error(data.message || 'Failed to load status');
        }
    } catch (error) {
        console.error('Error loading OSC status:', error);
        updateStatusDisplay({ isRunning: false, error: error.message });
    }
}

async function loadNetworkInfo() {
    try {
        const response = await fetch('/api/osc/network');
        const data = await response.json();
        
        if (response.ok && data.success) {
            updateNetworkDisplay(data.network);
        } else {
            throw new Error(data.message || 'Failed to load network info');
        }
    } catch (error) {
        console.error('Error loading network info:', error);
        document.getElementById('serverIP').innerHTML = '<span class="text-danger">Error loading IP</span>';
    }
}

function updateNetworkDisplay(network) {
    const serverIPEl = document.getElementById('serverIP');
    serverIPEl.innerHTML = `<strong>${network.serverIP}</strong>`;
    serverIPEl.title = `Full connection: ${network.serverIP}:${network.oscPort}`;
}

async function loadOSCLog() {
    try {
        const response = await fetch('/api/osc/log');
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayOSCLog(data.log);
        } else {
            throw new Error(data.message || 'Failed to load OSC log');
        }
    } catch (error) {
        console.error('Error loading OSC log:', error);
        addLogEntryToDisplay({
            timestamp: new Date().toISOString(),
            type: 'error',
            message: `Error loading log: ${error.message}`,
            status: 'error'
        });
    }
}

function displayOSCLog(logEntries) {
    const logContainer = document.getElementById('oscLog');
    logContainer.innerHTML = '';
    
    if (logEntries.length === 0) {
        logContainer.innerHTML = `
            <div class="log-entry">
                <span class="log-time">Ready</span>
                <span class="log-message">OSC Router Manager initialized. Waiting for messages...</span>
            </div>
        `;
        return;
    }
    
    logEntries.forEach(entry => {
        addLogEntryToDisplay(entry, false);
    });
}

function addLogEntryToDisplay(entry, prepend = true) {
    const logContainer = document.getElementById('oscLog');
    const logEntry = createLogEntryElement(entry);
    
    if (prepend) {
        logContainer.insertBefore(logEntry, logContainer.firstChild);
    } else {
        logContainer.appendChild(logEntry);
    }
    
    // Keep only last 50 entries in display
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
    
    // Auto-scroll to top for new messages
    if (prepend) {
        logContainer.scrollTop = 0;
    }
}

function createLogEntryElement(entry) {
    const div = document.createElement('div');
    div.className = `log-entry log-${entry.status}`;
    
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const statusIcon = getStatusIcon(entry.status);
    
    let message = '';
    if (entry.type === 'received') {
        message = `${statusIcon} ${entry.address} ${JSON.stringify(entry.args)} from ${entry.source}`;
        if (entry.holeName) {
            message += ` → ${entry.holeName}`;
        }
        if (entry.destination) {
            message += ` → ${entry.destination}`;
        }
        if (entry.forwardedTo) {
            message += ` ✅ Forwarded to ${entry.forwardedTo}`;
        }
        if (entry.error) {
            message += ` ❌ ${entry.error}`;
        }
        if (entry.message) {
            message += ` (${entry.message})`;
        }
    } else {
        message = `${statusIcon} ${entry.message || 'Unknown event'}`;
    }
    
    div.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message">${message}</span>
    `;
    
    return div;
}

function getStatusIcon(status) {
    switch (status) {
        case 'forwarded': return '✅';
        case 'error': return '❌';
        case 'waiting': return '⏳';
        case 'processing': return '⚡️';
        default: return '📝';
    }
}

function clearLogDisplay() {
    const logContainer = document.getElementById('oscLog');
    logContainer.innerHTML = `
        <div class="log-entry">
            <span class="log-time">Cleared</span>
            <span class="log-message">Log cleared. Waiting for new messages...</span>
        </div>
    `;
}

function updateStatusDisplay(status) {
    // Router Status
    const routerStatusEl = document.getElementById('routerStatus');
    if (status.isRunning) {
        routerStatusEl.innerHTML = '<span class="badge bg-success">🟢 Running</span>';
    } else {
        routerStatusEl.innerHTML = '<span class="badge bg-danger">🔴 Stopped</span>';
    }
    
    // Connected Clients
    document.getElementById('connectedClients').textContent = status.connectedClients || 0;
    
    // Routing Entries
    document.getElementById('routingEntries').textContent = status.routingEntries || 0;
    
    // Mastermind Data
    const mastermindEl = document.getElementById('mastermindData');
    if (status.mastermindData) {
        const { float, string } = status.mastermindData;
        if (float !== null || string !== null) {
            mastermindEl.innerHTML = `Float: ${float || 'null'}, String: ${string || 'null'}`;
        } else {
            mastermindEl.textContent = 'No pending data';
        }
    } else {
        mastermindEl.textContent = 'Not available';
    }
    
    // Update button states
    const startBtn = document.getElementById('startOscBtn');
    const restartBtn = document.getElementById('restartOscBtn');
    const stopBtn = document.getElementById('stopOscBtn');
    
    if (status.isRunning) {
        startBtn.disabled = true;
        restartBtn.disabled = false;
        stopBtn.disabled = false;
    } else {
        startBtn.disabled = false;
        restartBtn.disabled = true;
        stopBtn.disabled = true;
    }
}

async function loadRoutingTable() {
    const loadingIndicator = document.getElementById('routingLoadingIndicator');
    const routingTable = document.getElementById('routingTable');
    
    loadingIndicator.style.display = 'block';
    routingTable.style.display = 'none';
    
    try {
        const response = await fetch('/api/osc/routing');
        const data = await response.json();
        
        if (response.ok && data.success) {
            displayRoutingTable(data.routing);
            routingTable.style.display = 'block';
        } else {
            throw new Error(data.message || 'Failed to load routing table');
        }
    } catch (error) {
        console.error('Error loading routing table:', error);
        addLogEntry('Error loading routing table: ' + error.message, 'error');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function displayRoutingTable(routing) {
    const routingTable = document.getElementById('routingTable');
    
    let html = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>Hole Name</th>
                    <th>Destination Address</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    Object.entries(routing).forEach(([hole, address]) => {
        const [ip, port] = address.includes(':') ? address.split(':', 2) : [address, '58008'];
        
        html += `
            <tr>
                <td><strong>${hole}</strong></td>
                <td><code>${address}</code></td>
                <td><span class="badge bg-info">Configured</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editRouting('${hole}', '${address}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-outline-success" onclick="testRouting('${hole}')">
                        🧪 Test
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    routingTable.innerHTML = html;
}

function editRouting(holeName, address) {
    currentEditHole = holeName;
    document.getElementById('editHoleName').value = holeName;
    document.getElementById('editHoleAddress').value = address;
    
    const modal = new bootstrap.Modal(document.getElementById('editRoutingModal'));
    modal.show();
}

async function saveRoutingChanges() {
    if (!currentEditHole) return;
    
    const newAddress = document.getElementById('editHoleAddress').value.trim();
    if (!newAddress) {
        showError('Address is required');
        return;
    }
    
    // Validate address format
    const addressRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;
    if (!addressRegex.test(newAddress)) {
        showError('Invalid address format. Use IP:PORT (e.g., 192.168.1.100:58008)');
        return;
    }
    
    const saveBtn = document.getElementById('saveRoutingBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
    saveBtn.disabled = true;
    
    try {
        const response = await fetch(`/api/osc/routing/${currentEditHole}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: newAddress })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showSuccess(`Routing updated for ${currentEditHole}: ${newAddress}`);
            
            // Close modal and refresh table
            const modal = bootstrap.Modal.getInstance(document.getElementById('editRoutingModal'));
            modal.hide();
            loadRoutingTable();
            
            addLogEntry(`Routing updated: ${currentEditHole} → ${newAddress}`, 'success');
        } else {
            throw new Error(result.message || 'Failed to update routing');
        }
    } catch (error) {
        console.error('Error saving routing:', error);
        showError('Failed to save routing: ' + error.message);
        addLogEntry(`Error updating routing: ${error.message}`, 'error');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
        currentEditHole = null;
    }
}

async function testRouting(holeName) {
    addLogEntry(`Testing routing for ${holeName}...`, 'info');
    
    // This would send a test OSC message - for now just log
    // In a real implementation, you might want to add a test endpoint
    showSuccess(`Test message would be sent to ${holeName}`);
}

async function startOSCRouter() {
    await controlOSCRouter('start', 'Starting OSC Router...');
}

async function restartOSCRouter() {
    await controlOSCRouter('restart', 'Restarting OSC Router...');
}

async function stopOSCRouter() {
    await controlOSCRouter('stop', 'Stopping OSC Router...');
}

async function controlOSCRouter(action, loadingMessage) {
    const buttons = ['startOscBtn', 'restartOscBtn', 'stopOscBtn'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        btn.disabled = true;
        if (btn.id === `${action}OscBtn`) {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ' + loadingMessage;
        }
    });
    
    try {
        const response = await fetch(`/api/osc/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showSuccess(result.message);
            addLogEntry(`OSC Router ${action}ed successfully`, 'success');
            
            // Refresh status after a short delay
            setTimeout(() => {
                loadStatus();
            }, 1000);
        } else {
            throw new Error(result.message || `Failed to ${action} OSC Router`);
        }
    } catch (error) {
        console.error(`Error ${action}ing OSC Router:`, error);
        showError(`Failed to ${action} OSC Router: ` + error.message);
        addLogEntry(`Error ${action}ing OSC Router: ${error.message}`, 'error');
    } finally {
        // Restore buttons
        document.getElementById('startOscBtn').innerHTML = '▶️ Start Router';
        document.getElementById('restartOscBtn').innerHTML = '🔄 Restart Router';
        document.getElementById('stopOscBtn').innerHTML = '⏹️ Stop Router';
        
        // Status will be updated by the next auto-refresh
    }
}

function addLogEntry(message, type = 'info') {
    if (logPaused) return;
    
    const logContainer = document.getElementById('oscLog');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `
        <span class="log-time">${timestamp}</span>
        <span class="log-message">${message}</span>
    `;
    
    // Add to top of log
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // Keep only last 100 entries
    const entries = logContainer.querySelectorAll('.log-entry');
    if (entries.length > 100) {
        for (let i = 100; i < entries.length; i++) {
            entries[i].remove();
        }
    }
}

function clearLog() {
    const logContainer = document.getElementById('oscLog');
    logContainer.innerHTML = `
        <div class="log-entry">
            <span class="log-time">Cleared</span>
            <span class="log-message">Log cleared by user</span>
        </div>
    `;
}

function toggleLogPause() {
    const pauseBtn = document.getElementById('pauseLogBtn');
    logPaused = !logPaused;
    
    if (logPaused) {
        pauseBtn.innerHTML = '▶️ Resume';
        pauseBtn.classList.remove('btn-outline-primary');
        pauseBtn.classList.add('btn-outline-success');
        addLogEntry('Log paused', 'info');
    } else {
        pauseBtn.innerHTML = '⏸️ Pause';
        pauseBtn.classList.remove('btn-outline-success');
        pauseBtn.classList.add('btn-outline-primary');
        addLogEntry('Log resumed', 'info');
    }
}

function showSuccess(message) {
    document.getElementById('successMessage').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('successModal'));
    modal.show();
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    modal.show();
}
