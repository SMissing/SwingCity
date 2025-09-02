// SwingCity V2 Tablet Interface
// Handles real-time game state and communication with server

class TabletInterface {
    constructor(holeId, holeConfig, gameConfig) {
        this.holeId = holeId;
        this.holeConfig = holeConfig;
        this.gameConfig = gameConfig;
        this.socket = null;
        this.currentGame = null;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        
        this.init();
    }

    init() {
        console.log(`🎯 Initializing tablet for hole: ${this.holeId}`);
        // Create the score panel overlay
        this.createScorePanel();
        // Initialize socket connection
        this.initSocket();
        // Set up UI event listeners
        this.setupEventListeners();
        // Start connection status updates
        this.updateConnectionStatus();
        // Show waiting state initially
        this.showGameState('waiting');
    }

    initSocket() {
        // Connect to Socket.io server
        this.socket = io();
        // Debug: log all socket events
        const origOn = this.socket.on;
        this.socket.on = (event, handler) => {
            origOn.call(this.socket, event, (...args) => {
                console.log(`[SOCKET EVENT]`, event, ...args);
                handler(...args);
            });
        };
        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.connectionRetries = 0;
            this.updateConnectionStatus(true);
            // Register this tablet with the server
            this.socket.emit('tablet-register', {
                holeId: this.holeId,
                tabletId: `tablet-${this.holeId}`
            });
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.updateConnectionStatus(false);
            this.attemptReconnection();
        });

        // Game event handlers
        this.socket.on('game-started', (gameData) => {
            console.log('🎮 Game started:', gameData);
            this.currentGame = gameData;
            const teamName = gameData.teamName || gameData.name || 'Team';
            console.log(`🎮 Team loaded: ${teamName} with ${gameData.players?.length || 0} players`);
            this.showGameState('playing');
            this.updateGameDisplay();
        });

        this.socket.on('score-update', (gameData) => {
            console.log('🎯 Score update:', gameData);
            this.currentGame = gameData;
            const currentPlayer = gameData.players[gameData.currentPlayerIndex];
            let lastScore = null;
            let throwCount = 0;
            if (currentPlayer && currentPlayer.scores && currentPlayer.scores[this.holeId]) {
                const throws = currentPlayer.scores[this.holeId].throws;
                throwCount = throws.length;
                if (throwCount > 0) {
                    lastScore = throws[throwCount - 1];
                }
            }
            // Show the score panel if a new score was added
            if (lastScore !== null && lastScore !== undefined) {
                this.showScorePanel(lastScore, () => {
                    // Update ball indicator and throw display
                    this.updateGameDisplay();
                    this.updateBallIndicator(throwCount);
                    this.updateThrowScoreDisplay(throwCount, lastScore);
                    this.showScoreWaiting(false);
                    // If throwCount >= 3, mark player as finished
                    if (throwCount >= 3) {
                        this.showPlayerFinished();
                    }
                });
            } else {
                this.updateGameDisplay();
                this.showScoreWaiting(false);
            }
        });
    updateBallIndicator(throwCount) {
        // Reset all ball indicators
        for (let i = 1; i <= 3; i++) {
            const indicator = document.getElementById(`ball${i}Indicator`);
            if (indicator) {
                indicator.classList.remove('active', 'completed');
                if (i < throwCount) {
                    indicator.classList.add('completed');
                } else if (i === throwCount) {
                    indicator.classList.add('active');
                }
            }
        }
    }

    updateThrowScoreDisplay(throwCount, score) {
        // Update the score next to the last ball thrown
        const ballScoreElement = document.getElementById(`ballScore${throwCount}`);
        if (ballScoreElement) {
            ballScoreElement.textContent = (score > 0 ? '+' : '') + score;
        }
    }

    showPlayerFinished() {
        // Optionally show a message or effect that the player is finished
        // For now, just log
        console.log('🏁 Player finished all throws for this hole!');
    }

    // (showScorePanel already handles yellow/red panel logic)
    createScorePanel() {
        // Create the panel element if it doesn't exist
        if (document.getElementById('scorePanel')) return;
        const panel = document.createElement('div');
        panel.id = 'scorePanel';
        panel.style.cssText = `
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: 99999;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            background-repeat: repeat;
            background-size: cover;
        `;
        const scoreText = document.createElement('div');
        scoreText.id = 'scorePanelText';
        scoreText.style.cssText = `
            font-size: 7vw;
            font-weight: bold;
            padding: 2vw 6vw;
            border-radius: 2vw;
            box-shadow: 0 4px 32px rgba(0,0,0,0.2);
            margin-bottom: 2vw;
        `;
        panel.appendChild(scoreText);
        document.body.appendChild(panel);
    }

    showScorePanel(score, onDone) {
        const panel = document.getElementById('scorePanel');
        const scoreText = document.getElementById('scorePanelText');
        if (!panel || !scoreText) return;

        // Style panel and text based on score
        if (score >= 0) {
            panel.style.background = "#ffe066 url('/public/images/background-png/Stripes.PNG') repeat";
            scoreText.style.color = '#fff';
            scoreText.style.background = 'rgba(255, 224, 102, 0.95)';
            scoreText.style.textShadow = '0 2px 8px #bfa600';
        } else {
            panel.style.background = "#ff69b4 url('/public/images/background-png/Stripes.PNG') repeat";
            scoreText.style.color = '#111';
            scoreText.style.background = 'rgba(255, 105, 180, 0.95)';
            scoreText.style.textShadow = '0 2px 8px #b4005a';
        }
        scoreText.textContent = (score > 0 ? '+' : '') + score;

        panel.style.display = 'flex';
        // Hide after 3 seconds, then call onDone
        setTimeout(() => {
            panel.style.display = 'none';
            if (typeof onDone === 'function') onDone();
        }, 3000);
    }

        this.socket.on('next-player', (gameData) => {
            console.log('👤 Next player:', gameData);
            this.currentGame = gameData;
            this.updateGameDisplay();
            this.playPlayerChangeSound();
        });

        this.socket.on('game-complete', (gameData) => {
            console.log('🏁 Game complete:', gameData);
            this.currentGame = gameData;
            this.showGameState('complete');
            this.displayFinalScores();
            this.startCompletionCountdown();
        });

        this.socket.on('hole-state-update', (holeState) => {
            console.log('🏳️ Hole state update received:', holeState);
            if (holeState && holeState.status === 'playing') {
                console.log('🎮 Existing game found - restoring game state');
                this.currentGame = holeState;
                const teamName = holeState.teamName || holeState.name || 'Team';
                console.log(`🎮 Restoring team: ${teamName}`);
                this.showGameState('playing');
                this.updateGameDisplay();
            } else if (!holeState) {
                console.log('🏳️ No active game on this hole');
                this.showGameState('waiting');
            }
        });

        this.socket.on('error', (error) => {
            console.error('🚨 Socket error:', error);
            this.showError(error.message || 'Connection error occurred');
        });

        // Real-time database update handlers
        this.socket.on('team-data-updated', (data) => {
            console.log('📊 Real-time team data update:', data);
            if (this.currentGame && this.currentGame.rfid === data.rfid) {
                // Update current game with fresh data from database
                this.currentGame.players = data.teamData.players;
                this.currentGame.teamName = data.teamData.teamName;
                this.updateGameDisplay();
                this.showNotification('Scores updated from database');
            }
        });

        this.socket.on('game-state-updated', (gameData) => {
            console.log('🔄 Game state updated from database:', gameData);
            if (gameData && gameData.holeId === this.holeId) {
                this.currentGame = gameData;
                this.updateGameDisplay();
            }
        });

    // Remove player-score-update handler; score-update now updates the full UI

    // (Removed OSC debug socket listener)
    }

    attemptReconnection() {
        if (this.connectionRetries < this.maxRetries) {
            this.connectionRetries++;
            console.log(`🔄 Attempting reconnection ${this.connectionRetries}/${this.maxRetries}`);
            
            setTimeout(() => {
                this.socket.connect();
            }, 2000 * this.connectionRetries); // Exponential backoff
        } else {
            this.showError('Connection lost. Please refresh the page.');
        }
    }

    setupEventListeners() {
        // Add any tablet-specific event listeners here
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.disconnect();
            }
        });

        // Handle visibility changes (tablet sleep/wake)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.socket && !this.socket.connected) {
                this.socket.connect();
            }
        });

        // RFID keyboard input handling
        this.setupRFIDInput();
    }

    setupRFIDInput() {
        let rfidInput = '';
        let rfidTimeout = null;

        document.addEventListener('keydown', (e) => {
            console.log('🎹 Key pressed:', e.key, 'Current state:', this.getCurrentState());
            
            // Only capture RFID input when in waiting state
            const currentState = this.getCurrentState();
            if (currentState !== 'waiting') {
                console.log('⚠️ Not in waiting state, ignoring key:', e.key);
                return;
            }
            
            // Handle RFID input (numbers, letters, and some special characters)
            if (e.key.match(/^[0-9A-Fa-f]$/)) {
                rfidInput += e.key;
                
                // Clear any existing timeout
                if (rfidTimeout) {
                    clearTimeout(rfidTimeout);
                }
                
                // Set timeout to clear input if no Enter received (in case of partial scan)
                rfidTimeout = setTimeout(() => {
                    console.log('🚨 RFID input timeout, clearing buffer');
                    rfidInput = '';
                }, 3000);
                
            } else if (e.key === 'Enter' && rfidInput) {
                // RFID scanners send Enter after the card data
                e.preventDefault(); // Prevent form submission if any
                
                // Clear timeout
                if (rfidTimeout) {
                    clearTimeout(rfidTimeout);
                }
                
                console.log(`📡 RFID Card Detected: ${rfidInput}`);
                this.handleRFIDScan(rfidInput);
                rfidInput = ''; // Reset
                
            } else if (e.key === 'Escape') {
                // Allow manual clearing of input buffer
                if (rfidTimeout) {
                    clearTimeout(rfidTimeout);
                }
                rfidInput = '';
                console.log('🔄 RFID input buffer cleared');
            }
        });
    }

    async handleRFIDScan(rfidCode) {
        console.log(`🎯 Processing RFID: ${rfidCode}`);
        
        try {
            // Send RFID tap to server
            const response = await fetch('/api/rfid/tap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rfid: rfidCode,
                    holeId: this.holeId
                })
            });
            
            if (response.ok) {
                console.log('✅ RFID tap sent to server successfully');
                // Server will send game-started event via socket.io if successful
            } else {
                console.error('❌ RFID tap failed');
                this.showError('Failed to process RFID tap');
            }
            
        } catch (error) {
            console.error('❌ Network error:', error);
            this.showError('Network error occurred');
        }
    }

    getCurrentState() {
        const activeState = document.querySelector('.game-state.active');
        return activeState ? activeState.id.replace('State', '') : 'waiting';
    }

    showGameState(state) {
        // Hide all game states
        document.querySelectorAll('.game-state').forEach(el => {
            el.classList.remove('active');
        });
        
        // Show the requested state - match the tablet.ejs naming convention
        const stateElement = document.getElementById(`${state}State`);
        if (stateElement) {
            stateElement.classList.add('active');
            
            // Update status indicator
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                switch(state) {
                    case 'waiting':
                        statusIndicator.textContent = 'Waiting for Team';
                        statusIndicator.className = 'status-indicator waiting';
                        break;
                    case 'playing':
                        statusIndicator.textContent = 'Playing';
                        statusIndicator.className = 'status-indicator playing';
                        break;
                    case 'completed':
                        statusIndicator.textContent = 'Complete';
                        statusIndicator.className = 'status-indicator complete';
                        break;
                    case 'error':
                        statusIndicator.textContent = 'Error';
                        statusIndicator.className = 'status-indicator error';
                        break;
                }
            }
        }
        
        this.logActivity(`Game state changed to: ${state}`);
    }

    updateGameDisplay() {
        if (!this.currentGame) return;

        // Update status to show team name
        const teamName = this.currentGame.teamName || this.currentGame.name || 'Team';
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.textContent = `${teamName} Playing`;
            statusIndicator.className = 'status-indicator playing';
        }

        // Update team info if there's a team element
        const teamRfidElement = document.getElementById('team-rfid');
        if (teamRfidElement) {
            teamRfidElement.textContent = this.currentGame.rfid;
        }

        // Update players list
        this.updatePlayersList();
        
        // Update current player
        this.updateCurrentPlayer();
        
        // Update scoring display
        this.updateScoreDisplay();

        // Show the playing state
        this.showGameState('playing');
        
        this.logActivity(`Updated display for team: ${teamName}`);
    }

    updatePlayersList() {
        if (!this.currentGame || !this.currentGame.players) return;

        // Update the bottom team border with team members
        const bottomTeamBorder = document.getElementById('bottomTeamBorder');
        if (bottomTeamBorder) {
            bottomTeamBorder.innerHTML = '';
            
            this.currentGame.players.forEach((player, index) => {
                const playerElement = document.createElement('div');
                playerElement.className = `team-member ${index === (this.currentGame.currentPlayerIndex || 0) ? 'active' : ''}`;
                
                const playerTotal = this.getPlayerHoleTotal(player);
                playerElement.innerHTML = `
                    <div class="member-name">${player.name}</div>
                    <div class="member-score">${playerTotal}</div>
                `;
                
                bottomTeamBorder.appendChild(playerElement);
            });
            
            // Show the bottom border
            bottomTeamBorder.style.display = 'flex';
        }

        // Also try to update any players-list element if it exists
        const playersListElement = document.getElementById('players-list');
        if (playersListElement) {
            playersListElement.innerHTML = '';
            
            this.currentGame.players.forEach((player, index) => {
                const playerElement = document.createElement('div');
                playerElement.className = `player-item ${index === (this.currentGame.currentPlayerIndex || 0) ? 'active' : ''}`;
                
                const playerTotal = this.getPlayerHoleTotal(player);
                playerElement.innerHTML = `
                    <span class="player-name">${player.name}</span>
                    <span class="player-score">${playerTotal} pts</span>
                `;
                
                playersListElement.appendChild(playerElement);
            });
        }

        console.log(`📋 Updated player list: ${this.currentGame.players.length} players`);
    }

    updateCurrentPlayer() {
        if (!this.currentGame || !this.currentGame.players) return;

        const currentPlayerIndex = this.currentGame.currentPlayerIndex || 0;
        const currentPlayer = this.currentGame.players[currentPlayerIndex];
        if (!currentPlayer) return;

        // Update current player name (matches tablet.ejs: currentPlayerName)
        const nameElement = document.getElementById('currentPlayerName');
        if (nameElement) {
            nameElement.textContent = currentPlayer.name;
        }

        // Update current player score (matches tablet.ejs: currentPlayerScore)
        const scoreElement = document.getElementById('currentPlayerScore');
        if (scoreElement) {
            const total = this.getPlayerHoleTotal(currentPlayer);
            scoreElement.textContent = total;
        }

        // Update throw information if element exists
        const throwElement = document.getElementById('current-throw');
        if (throwElement) {
            throwElement.textContent = (this.currentGame.currentThrow || 0) + 1;
        }

        // Show the scoreboard button
        const scoreboardBtn = document.getElementById('openScoreboardBtn');
        if (scoreboardBtn) {
            scoreboardBtn.style.display = 'block';
        }

        // Show bottom team border
        const bottomBorder = document.getElementById('bottomTeamBorder');
        if (bottomBorder) {
            bottomBorder.style.display = 'flex';
        }

        // Activate the first ball indicator (pink/active state)
        this.activateBallIndicator(1);

        console.log(`👤 Current player: ${currentPlayer.name} (${currentPlayerIndex + 1}/${this.currentGame.players.length})`);
    }

    activateBallIndicator(ballNumber) {
        // Reset all ball indicators
        for (let i = 1; i <= 3; i++) {
            const indicator = document.getElementById(`ball${i}Indicator`);
            if (indicator) {
                indicator.classList.remove('active', 'completed');
            }
        }

        // Activate the specified ball
        const activeIndicator = document.getElementById(`ball${ballNumber}Indicator`);
        if (activeIndicator) {
            activeIndicator.classList.add('active');
        }

        console.log(`🏀 Ball ${ballNumber} indicator activated`);
    }

    updateScoreDisplay() {
        if (!this.currentGame) return;

        const currentPlayer = this.currentGame.players[this.currentGame.currentPlayerIndex];
        if (!currentPlayer) return;

        // Update the center score (currentPlayerScore)
        const scoreElement = document.getElementById('currentPlayerScore');
        if (scoreElement) {
            const total = this.getPlayerHoleTotal(currentPlayer);
            scoreElement.textContent = total;
        }

        // Update ball score display (ballScore1, ballScore2, ballScore3)
        const holeScores = currentPlayer.scores[this.holeId];
        for (let i = 1; i <= 3; i++) {
            const ballScoreElement = document.getElementById(`ballScore${i}`);
            if (ballScoreElement) {
                let scoreText = '';
                if (holeScores && holeScores.throws && holeScores.throws[i-1] !== undefined) {
                    const score = holeScores.throws[i-1];
                    scoreText = score > 0 ? `+${score}` : `${score}`;
                }
                ballScoreElement.textContent = scoreText;
            }
        }
    }

    getPlayerHoleTotal(player) {
        if (!player.scores || !player.scores[this.holeId]) return 0;
        return player.scores[this.holeId].total || 0;
    }

    showScoreWaiting(show = true) {
        const waitingElement = document.getElementById('score-waiting');
        if (waitingElement) {
            waitingElement.style.display = show ? 'block' : 'none';
        }
    }

    displayFinalScores() {
        if (!this.currentGame) return;

        const finalScoresElement = document.getElementById('final-scores');
        if (!finalScoresElement) return;

        finalScoresElement.innerHTML = '';
        
        this.currentGame.players.forEach(player => {
            const playerScoreElement = document.createElement('div');
            playerScoreElement.className = 'player-final-score';
            
            const total = this.getPlayerHoleTotal(player);
            playerScoreElement.innerHTML = `
                <h4>${player.name}</h4>
                <div class="final-score-value">${total} points</div>
            `;
            
            finalScoresElement.appendChild(playerScoreElement);
        });
    }

    startCompletionCountdown() {
        let countdown = 5;
        const countdownElement = document.getElementById('countdown-timer');
        
        const countdownInterval = setInterval(() => {
            if (countdownElement) {
                countdownElement.textContent = countdown;
            }
            
            countdown--;
            
            if (countdown < 0) {
                clearInterval(countdownInterval);
                this.returnToWaiting();
            }
        }, 1000);
    }

    returnToWaiting() {
        this.currentGame = null;
        this.showGameState('waiting');
        this.playResetSound();
    }

    showError(message) {
        console.error('❌ Error:', message);
        // You can implement visual error display here
        // For now, just log to console
    }

    showNotification(message) {
        console.log('📢 Notification:', message);
        // Create a simple notification display
        const notification = document.createElement('div');
        notification.className = 'tablet-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    updateConnectionStatus(connected = false) {
        const statusElement = document.getElementById('connection-status');
        const socketStatusElement = document.getElementById('socket-status');
        
        if (statusElement) {
            statusElement.textContent = connected ? '🟢 Connected' : '🔴 Disconnected';
        }
        
        if (socketStatusElement) {
            socketStatusElement.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    logActivity(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${message}`);
        
        // Update debug info
        const lastUpdateElement = document.getElementById('last-update');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = timestamp;
        }
    }

    playPlayerChangeSound() {
        // Play a gentle notification sound for player changes
        this.playSound('player-change');
    }

    playScoreSound(score) {
        // Play different sounds based on score
        if (score > 0) {
            this.playSound('positive-score');
        } else {
            this.playSound('negative-score');
        }
    }

    playResetSound() {
        this.playSound('reset');
    }

    playSound(type) {
        // Implement sound playing logic here
        // For now, just log the sound type
        console.log(`🔊 Playing sound: ${type}`);
    }

    // Public methods for external control
    reset() {
        this.currentGame = null;
        this.showGameState('waiting');
        this.logActivity('Tablet reset manually');
    }

    simulateRFID(rfid) {
        // For testing purposes
        console.log(`🧪 Simulating RFID tap: ${rfid}`);
        // This would normally come from the Raspberry Pi
    }

    simulateScore(score) {
        // For testing purposes
        console.log(`🧪 Simulating score: ${score}`);
        this.showScoreWaiting(true);
        
        // Simulate server response after delay
        setTimeout(() => {
            this.showScoreWaiting(false);
            this.playScoreSound(score);
        }, 2000);
    }
}

// Global reset function for admin
function resetHole() {
    if (window.tabletInterface) {
        window.tabletInterface.reset();
    } else {
        location.reload();
    }
}

// Make TabletInterface globally available
window.TabletInterface = TabletInterface;
