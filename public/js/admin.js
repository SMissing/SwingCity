// SwingCity V2 Admin Dashboard
// Real-time monitoring and control interface

class AdminDashboard {
    constructor() {
        this.socket = null;
        this.updateInterval = null;
        this.startTime = new Date();
        
        this.init();
    }

    init() {
        console.log('🔧 Initializing admin dashboard');
        
        // Initialize socket connection
        this.initSocket();
        
        // Set up periodic updates
        this.startPeriodicUpdates();
        
        // Initialize UI components
        this.setupEventListeners();
        
        // Load initial data
        this.refreshDashboard();
    }

    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('✅ Admin connected to server');
            this.logMessage('Connected to server', 'info');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Admin disconnected from server');
            this.logMessage('Disconnected from server', 'warn');
        });

        // Listen for real-time updates
        this.socket.on('game-started', (data) => {
            this.logMessage(`Game started: RFID ${data.rfid} at ${data.holeId}`, 'info');
            // Format the data for display
            const gameDisplayData = {
                rfid: data.rfid,
                teamName: data.teamName,
                holeId: data.holeId,
                players: data.players,
                currentPlayerIndex: data.currentPlayerIndex || 0,
                currentThrow: data.currentThrow || 0,
                currentPlayer: data.players && data.players[data.currentPlayerIndex || 0]
            };
            this.updateHoleStatus(data.holeId, 'playing', gameDisplayData);
            this.refreshActiveGames();
        });

        this.socket.on('game-complete', (data) => {
            this.logMessage(`Game completed: RFID ${data.rfid} at ${data.holeId}`, 'info');
            this.updateHoleStatus(data.holeId, 'idle');
            this.refreshActiveGames();
        });
        
        this.socket.on('hole-reset', (data) => {
            this.logMessage(`Hole reset: ${data.holeId}`, 'info');
            this.updateHoleStatus(data.holeId, 'idle');
            this.refreshActiveGames();
        });
        
        this.socket.on('all-holes-reset', (data) => {
            this.logMessage(`All holes reset (${data.resetHoles.length} holes)`, 'info');
            data.resetHoles.forEach(holeId => {
                this.updateHoleStatus(holeId, 'idle');
            });
            this.refreshActiveGames();
        });
        
        this.socket.on('game-ended', (data) => {
            this.logMessage(`Game ended: RFID ${data.rfid} at ${data.holeId} (${data.reason})`, 'info');
            this.updateHoleStatus(data.holeId, 'idle');
            this.refreshActiveGames();
        });

        this.socket.on('score-update', (data) => {
            const currentPlayer = data.players[data.currentPlayerIndex];
            this.logMessage(`Score recorded: ${currentPlayer.name} at ${data.holeId}`, 'info');
        });

        this.socket.on('tablet-connected', (data) => {
            this.logMessage(`Tablet connected: ${data.holeId}`, 'info');
            this.updateConnectedTablets();
        });

        this.socket.on('tablet-disconnected', (data) => {
            this.logMessage(`Tablet disconnected: ${data.holeId}`, 'warn');
            this.updateConnectedTablets();
        });

        this.socket.on('error', (error) => {
            this.logMessage(`System error: ${error.message}`, 'error');
        });
    }

    setupEventListeners() {
        // Set up global functions for button clicks
        window.refreshDashboard = () => this.refreshDashboard();
        window.resetAllHoles = () => this.resetAllHoles();
        window.resetHole = (holeId) => this.resetHole(holeId);
        window.endGame = (rfid) => this.endGame(rfid);
        window.simulateRFIDTap = () => this.simulateRFIDTap();
        window.simulateScore = () => this.simulateScore();
        window.exportLogs = () => this.exportLogs();
        window.systemRestart = () => this.systemRestart();
    }

    startPeriodicUpdates() {
        // Update dashboard every 5 seconds
        this.updateInterval = setInterval(() => {
            this.updateSystemStats();
            this.updateUptime();
            // Also refresh active games periodically to catch any missed socket events
            this.refreshActiveGames();
        }, 5000);
    }

    async refreshDashboard() {
        try {
            // Fetch current system status
            const response = await fetch('/api/health');
            const healthData = await response.json();
            
            // Update stats
            this.updateStats(healthData);
            
            // Refresh active games and hole states
            await this.refreshActiveGames();
            
            // Update timestamp
            document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
            
            this.logMessage('Dashboard refreshed', 'info');
        } catch (error) {
            console.error('Failed to refresh dashboard:', error);
            this.logMessage(`Failed to refresh: ${error.message}`, 'error');
        }
    }

    updateStats(healthData) {
        // Update active games count
        const activeGamesElement = document.getElementById('active-games');
        if (activeGamesElement) {
            activeGamesElement.textContent = healthData.activeGames || 0;
        }

        // Update connected tablets count
        const connectedTabletsElement = document.getElementById('connected-tablets');
        if (connectedTabletsElement) {
            connectedTabletsElement.textContent = healthData.connectedTablets || 0;
        }

        // Update system status
        const systemStatusElement = document.getElementById('system-status');
        if (systemStatusElement) {
            if (healthData.status === 'healthy') {
                systemStatusElement.textContent = '🟢 System Online';
                systemStatusElement.className = 'status-indicator healthy';
            } else {
                systemStatusElement.textContent = '🔴 System Issues';
                systemStatusElement.className = 'status-indicator error';
            }
        }

        // Update Firebase status
        const firebaseElement = document.getElementById('firebase-status');
        if (firebaseElement) {
            if (healthData.firebase && healthData.firebase.connected) {
                firebaseElement.textContent = '🔥 Connected';
                firebaseElement.className = 'stat-number firebase-connected';
            } else {
                firebaseElement.textContent = '⚠️ Mock Mode';
                firebaseElement.className = 'stat-number firebase-mock';
            }
        }
    }

    updateUptime() {
        const uptimeElement = document.getElementById('uptime');
        if (uptimeElement) {
            const uptime = Date.now() - this.startTime.getTime();
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            uptimeElement.textContent = `${hours}h ${minutes}m`;
        }
    }

    updateHoleStatus(holeId, status, gameData = null) {
        const statusElement = document.getElementById(`status-${holeId}`);
        const detailsElement = document.getElementById(`details-${holeId}`);
        
        if (statusElement) {
            statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            statusElement.className = `hole-status ${status}`;
        }

        if (detailsElement) {
            if (status === 'playing' && gameData) {
                const currentPlayer = gameData.players && gameData.players[gameData.currentPlayerIndex] 
                    ? gameData.players[gameData.currentPlayerIndex] 
                    : gameData.currentPlayer || { name: 'Unknown' };
                    
                detailsElement.innerHTML = `
                    <small style="color: #28a745; font-weight: 500;">
                        <strong>🎮 ${gameData.teamName || `Team ${gameData.rfid}`}</strong><br>
                        👤 ${currentPlayer.name}<br>
                        🏌️ Throw ${(gameData.currentThrow || 0) + 1}/3
                    </small>
                `;
            } else {
                detailsElement.innerHTML = '<small style="color: #6c757d;">No active game</small>';
            }
        }
    }

    async refreshActiveGames() {
        try {
            const response = await fetch('/api/games/active');
            if (!response.ok) {
                throw new Error('Failed to fetch active games');
            }
            
            const data = await response.json();
            
            // Update active games table
            const activeGamesTable = document.getElementById('active-games-table');
            if (activeGamesTable) {
                if (data.activeGames.length === 0) {
                    activeGamesTable.innerHTML = '<tr><td colspan="6" class="text-center">No active games</td></tr>';
                } else {
                    activeGamesTable.innerHTML = data.activeGames.map(game => `
                        <tr data-rfid="${game.rfid}">
                            <td>${game.rfid}</td>
                            <td>${game.holeId}</td>
                            <td>${game.currentPlayer ? game.currentPlayer.name : 'Unknown'}</td>
                            <td>${game.currentThrow + 1}/3</td>
                            <td>${new Date(game.startTime).toLocaleTimeString()}</td>
                            <td>
                                <button onclick="endGame('${game.rfid}')" class="btn btn-danger btn-sm">
                                    🛑 End Game
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
            
            // Update active games count
            const activeGamesCount = document.getElementById('active-games');
            if (activeGamesCount) {
                activeGamesCount.textContent = data.activeGames.length;
            }
            
            // Update connected tablets count
            const connectedTabletsCount = document.getElementById('connected-tablets');
            if (connectedTabletsCount) {
                connectedTabletsCount.textContent = data.summary.connectedTablets;
            }
            
            // Update hole statuses based on current state
            data.holeStates.forEach(holeState => {
                if (holeState.status === 'playing' || holeState.rfid) {
                    // Find the corresponding active game for more complete data
                    const activeGame = data.activeGames.find(game => game.rfid === holeState.rfid);
                    if (activeGame) {
                        // Use the active game data which has more complete information
                        const gameDisplayData = {
                            rfid: activeGame.rfid,
                            teamName: activeGame.teamName,
                            holeId: activeGame.holeId,
                            players: [activeGame.currentPlayer], // Simplified for display
                            currentPlayerIndex: 0,
                            currentThrow: activeGame.currentThrow || 0,
                            currentPlayer: activeGame.currentPlayer
                        };
                        this.updateHoleStatus(holeState.holeId, 'playing', gameDisplayData);
                    } else {
                        // Fallback to hole state data
                        const gameDisplayData = {
                            rfid: holeState.rfid,
                            teamName: holeState.teamName,
                            holeId: holeState.holeId,
                            currentPlayer: holeState.currentPlayer || { name: 'Unknown' },
                            currentThrow: 0
                        };
                        this.updateHoleStatus(holeState.holeId, 'playing', gameDisplayData);
                    }
                } else {
                    this.updateHoleStatus(holeState.holeId, 'idle');
                }
            });
            
        } catch (error) {
            this.logMessage(`Failed to refresh active games: ${error.message}`, 'error');
        }
    }

    updateConnectedTablets() {
        // Update the connected tablets count
        // This would be handled by the periodic health check
    }

    async resetHole(holeId) {
        try {
            const response = await fetch(`/api/hole/${holeId}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                this.logMessage(`Hole ${holeId} reset successfully`, 'info');
                this.updateHoleStatus(holeId, 'idle');
            } else {
                throw new Error('Reset failed');
            }
        } catch (error) {
            this.logMessage(`Failed to reset hole ${holeId}: ${error.message}`, 'error');
        }
    }

    async resetAllHoles() {
        if (!confirm('Are you sure you want to reset ALL holes? This will end any active games.')) {
            return;
        }

        try {
            const response = await fetch('/api/holes/reset-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                this.logMessage('All holes reset successfully', 'info');
                location.reload(); // Refresh the page
            } else {
                throw new Error('Reset all failed');
            }
        } catch (error) {
            this.logMessage(`Failed to reset all holes: ${error.message}`, 'error');
        }
    }

    async endGame(rfid) {
        if (!confirm(`Are you sure you want to end the game for RFID ${rfid}?`)) {
            return;
        }

        try {
            const response = await fetch('/api/game/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rfid })
            });
            
            if (response.ok) {
                this.logMessage(`Game ended for RFID ${rfid}`, 'info');
                this.refreshActiveGames();
            } else {
                throw new Error('End game failed');
            }
        } catch (error) {
            this.logMessage(`Failed to end game: ${error.message}`, 'error');
        }
    }

    async simulateRFIDTap() {
        const rfid = document.getElementById('test-rfid').value;
        const holeId = document.getElementById('test-hole').value;

        if (!rfid || !holeId) {
            alert('Please enter RFID and select a hole');
            return;
        }

        try {
            const response = await fetch('/api/rfid/tap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    rfid, 
                    holeId, 
                    picoId: 'admin-simulation' 
                })
            });
            
            if (response.ok) {
                this.logMessage(`Simulated RFID tap: ${rfid} at ${holeId}`, 'info');
            } else {
                throw new Error('RFID simulation failed');
            }
        } catch (error) {
            this.logMessage(`RFID simulation failed: ${error.message}`, 'error');
        }
    }

    async simulateScore() {
        const rfid = document.getElementById('test-rfid').value;
        const holeId = document.getElementById('test-hole').value;
        const score = parseInt(document.getElementById('test-score').value);
        const throwNumber = parseInt(document.getElementById('test-throw').value);

        if (!rfid || !holeId || isNaN(score) || isNaN(throwNumber)) {
            alert('Please fill in all fields with valid values');
            return;
        }

        try {
            const response = await fetch('/api/score/input', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    rfid, 
                    holeId, 
                    score, 
                    throwNumber,
                    picoId: 'admin-simulation' 
                })
            });
            
            if (response.ok) {
                this.logMessage(`Simulated score: ${score} for ${rfid} at ${holeId}`, 'info');
            } else {
                throw new Error('Score simulation failed');
            }
        } catch (error) {
            this.logMessage(`Score simulation failed: ${error.message}`, 'error');
        }
    }

    exportLogs() {
        const logEntries = document.querySelectorAll('.log-entry');
        let logText = 'SwingCity V2 System Logs\n';
        logText += `Exported: ${new Date().toISOString()}\n`;
        logText += '='.repeat(50) + '\n\n';

        logEntries.forEach(entry => {
            logText += entry.textContent + '\n';
        });

        // Create download
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `swingcity-logs-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        this.logMessage('Logs exported successfully', 'info');
    }

    systemRestart() {
        if (!confirm('Are you sure you want to restart the system? This will disconnect all tablets and end all games.')) {
            return;
        }

        this.logMessage('System restart initiated by admin', 'warn');
        
        // Show restart message
        alert('System restart initiated. Please wait 30 seconds before refreshing.');
        
        // In a real system, this would trigger a server restart
        setTimeout(() => {
            location.reload();
        }, 30000);
    }

    logMessage(message, level = 'info') {
        const logContainer = document.getElementById('log-container');
        if (!logContainer) return;

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const timestamp = new Date().toLocaleTimeString();
        logEntry.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="level ${level}">${level.toUpperCase()}</span>
            <span class="message">${message}</span>
        `;

        // Add to top of log
        logContainer.insertBefore(logEntry, logContainer.firstChild);

        // Keep only last 100 entries
        const entries = logContainer.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[entries.length - 1].remove();
        }

        // Auto-scroll to top
        logContainer.scrollTop = 0;
    }

    updateSystemStats() {
        // This would fetch real-time stats from the server
        // For now, just update the timestamp
        document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
    }

    async updateSystemHealth() {
        try {
            const response = await fetch('/api/health');
            const health = await response.json();
            
            // Update Firebase status
            const firebaseEl = document.getElementById('firebase-status');
            if (firebaseEl) {
                if (health.firebase && health.firebase.connected) {
                    firebaseEl.textContent = '🔥 Connected';
                    firebaseEl.className = 'stat-number firebase-connected';
                } else {
                    firebaseEl.textContent = '⚠️ Mock Mode';
                    firebaseEl.className = 'stat-number firebase-mock';
                }
            }
            
            // Update other stats
            const activeGamesEl = document.getElementById('active-games');
            if (activeGamesEl) {
                activeGamesEl.textContent = health.activeGames || 0;
            }
            
            const connectedTabletsEl = document.getElementById('connected-tablets');
            if (connectedTabletsEl) {
                connectedTabletsEl.textContent = health.connectedTablets || 0;
            }
            
            this.logMessage(`Health check: Firebase ${health.firebase?.connected ? 'connected' : 'mock mode'}`, 'info');
            
        } catch (error) {
            console.error('Failed to update system health:', error);
            this.logMessage('Failed to fetch system health', 'error');
        }
    }

    async loadLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard?limit=10');
            const data = await response.json();
            
            const tableBody = document.getElementById('leaderboard-table');
            if (!tableBody) return;
            
            if (data.leaderboard && data.leaderboard.length > 0) {
                tableBody.innerHTML = data.leaderboard.map((team, index) => `
                    <tr>
                        <td>
                            <span class="rank-badge rank-${index < 3 ? index + 1 : 'other'}">
                                ${index + 1}
                            </span>
                        </td>
                        <td><strong>${team.teamName}</strong></td>
                        <td><code>${team.rfid}</code></td>
                        <td>
                            <span class="score-badge ${team.totalScore > 0 ? 'positive' : 'negative'}">
                                ${team.totalScore}
                            </span>
                        </td>
                        <td>${team.holesCompleted}/12</td>
                        <td>${team.playerCount}</td>
                    </tr>
                `).join('');
            } else {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No teams found</td></tr>';
            }
            
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            const tableBody = document.getElementById('leaderboard-table');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load leaderboard</td></tr>';
            }
        }
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.adminDashboard) {
        window.adminDashboard.destroy();
    }
});
