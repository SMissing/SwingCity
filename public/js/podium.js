// Podium Page JavaScript - SwingCity V2

class PodiumManager {
    constructor() {
        this.socket = null;
        this.currentState = 'rfidInput';
        this.winners = [];
        this.currentRFID = null;
        this.teamName = '';
        this.logoSrc = '/images/swingcity-main-logo.png';
        
        this.init();
    }

    init() {
        console.log('Initializing Podium Manager...');
        
        // Initialize socket connection
        this.initSocket();
        
        // Setup RFID input (simulated by button click for demo)
        this.setupRFIDInput();
        
        // Auto-refresh every 30 seconds when showing podium
        setInterval(() => {
            if (this.currentState === 'podium') {
                this.refreshPodium();
            }
        }, 30000);
    }

    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Socket connected to server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Socket disconnected from server');
        });
        
        // Listen for RFID scans (if implemented)
        this.socket.on('rfidScanned', (data) => {
            console.log('RFID Scanned:', data);
            this.showPodium();
        });
    }

    setupRFIDInput() {
        // Listen for keyboard input to simulate RFID scanning
        let rfidBuffer = '';
        let rfidTimeout = null;
        
        document.addEventListener('keypress', (e) => {
            // Reset to RFID input if Enter is pressed and we're showing podium
            if (e.key === 'Enter' && this.currentState === 'podium') {
                console.log('Resetting podium to RFID input');
                this.resetPodium();
                return;
            }
            
            // Only listen for RFID input when in RFID input state
            if (this.currentState !== 'rfidInput') return;
            
            // Debug feature: Press "1" and Enter to add test team
            if (e.key === '1') {
                console.log('Debug mode: Adding test team');
                rfidBuffer = '1';
                return;
            }
            
            // Clear existing timeout
            if (rfidTimeout) {
                clearTimeout(rfidTimeout);
            }
            
            // Add character to buffer
            if (e.key !== 'Enter') {
                rfidBuffer += e.key;
                
                // Set timeout to process the RFID after a pause
                rfidTimeout = setTimeout(() => {
                    if (rfidBuffer.length > 3) { // Minimum RFID length
                        console.log('RFID detected via keyboard:', rfidBuffer);
                        this.currentRFID = rfidBuffer;
                        this.showPodium();
                    }
                    rfidBuffer = '';
                }, 100);
            } else {
                // Enter key pressed - process immediately
                if (rfidBuffer === '1') {
                    console.log('Debug mode: Creating test team and showing podium');
                    this.currentRFID = 'DEBUG001';
                    this.createTestTeamsAndShowPodium();
                } else if (rfidBuffer.length > 3) {
                    console.log('RFID detected via Enter:', rfidBuffer);
                    this.currentRFID = rfidBuffer;
                    this.showPodium();
                }
                rfidBuffer = '';
            }
        });
    }

    showPodium() {
        console.log('Showing podium...');
        
        // If no RFID is set, use a test RFID for the button click
        if (!this.currentRFID) {
            // Use the first real RFID from our test data (we know this exists from the server logs)
            this.currentRFID = '3751034116'; // This team exists based on the API response we saw earlier
        }
        
        this.changeState('loading');
        this.loadPodiumData();
    }

    async loadPodiumData() {
        try {
            if (!this.currentRFID) {
                throw new Error('No RFID card detected');
            }
            
            // Fetch podium data for the specific team
            const response = await fetch(`/api/podium/${this.currentRFID}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Team not found. Please check the RFID card.');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Team podium data:', data);
            
            // Process the top 3 players from this team
            this.winners = data.winners || [];
            this.teamName = data.teamName || `Team ${this.currentRFID}`;
            this.displayPodium();
            
        } catch (error) {
            console.error('Error loading podium data:', error);
            this.showError(`Failed to load team data: ${error.message}`);
        }
    }

    async createTestTeamsAndShowPodium() {
        console.log('Creating test team players for debugging...');
        this.changeState('loading');
        
        try {
            // Create mock test players data for debugging
            const testPlayers = [
                {
                    id: 'debug-player-1',
                    name: 'Alice Champion',
                    totalScore: 850,
                    scores: {
                        'Plinko': { total: 200, throws: [100, 50, 50] },
                        'SpinningTop': { total: 300, throws: [150, 150] },
                        'Haphazard': { total: 350, throws: [200, 100, 50] }
                    }
                },
                {
                    id: 'debug-player-2', 
                    name: 'Bob Runner-up',
                    totalScore: 1200,
                    scores: {
                        'Plinko': { total: 400, throws: [200, 200] },
                        'SpinningTop': { total: 400, throws: [200, 200] },
                        'Haphazard': { total: 400, throws: [200, 200] }
                    }
                },
                {
                    id: 'debug-player-3',
                    name: 'Charlie Bronze',
                    totalScore: 1450,
                    scores: {
                        'Plinko': { total: 500, throws: [250, 250] },
                        'SpinningTop': { total: 500, throws: [250, 250] },
                        'Haphazard': { total: 450, throws: [200, 250] }
                    }
                }
            ];

            // Sort by total score (lowest first for golf scoring)
            testPlayers.sort((a, b) => a.totalScore - b.totalScore);
            
            // Use test data as winners
            this.winners = testPlayers;
            this.teamName = 'Debug Test Team';
            console.log('Using test player data:', this.winners);
            
            // Add a small delay to simulate loading
            setTimeout(() => {
                this.displayPodium();
            }, 500);
            
        } catch (error) {
            console.error('Error creating test players:', error);
            this.showError('Failed to create test players.');
        }
    }

    displayPodium() {
        console.log('Displaying podium with players:', this.winners);
        
        // Update first place (center)
        if (this.winners.length >= 1) {
            const first = this.winners[0];
            document.getElementById('firstName').textContent = first.name || 'Champion';
            document.getElementById('firstScore').textContent = `${first.totalScore || 0} strokes`;
            document.getElementById('firstPlace').style.display = 'flex';
            document.getElementById('firstPlace').style.opacity = '1';
        } else {
            this.showPlaceholderPosition('firstPlace', 'firstName', 'firstScore');
        }

        // Update second place (left)
        if (this.winners.length >= 2) {
            const second = this.winners[1];
            document.getElementById('secondName').textContent = second.name || 'Runner-up';
            document.getElementById('secondScore').textContent = `${second.totalScore || 0} strokes`;
            document.getElementById('secondPlace').style.display = 'flex';
            document.getElementById('secondPlace').style.opacity = '1';
        } else {
            this.showPlaceholderPosition('secondPlace', 'secondName', 'secondScore');
        }

        // Update third place (right)
        if (this.winners.length >= 3) {
            const third = this.winners[2];
            document.getElementById('thirdName').textContent = third.name || 'Third Place';
            document.getElementById('thirdScore').textContent = `${third.totalScore || 0} strokes`;
            document.getElementById('thirdPlace').style.display = 'flex';
            document.getElementById('thirdPlace').style.opacity = '1';
        } else {
            this.showPlaceholderPosition('thirdPlace', 'thirdName', 'thirdScore');
        }

        this.changeState('podium');
    }

    showPlaceholderPosition(positionId, nameId, scoreId) {
        // Show SwingCity logo instead of name/score when no winner
        const nameElement = document.getElementById(nameId);
        const scoreElement = document.getElementById(scoreId);
        
        nameElement.innerHTML = `<img src="${this.logoSrc}" alt="SwingCity" style="max-width: 120px; height: auto; opacity: 0.7;">`;
        scoreElement.textContent = '';
        
        document.getElementById(positionId).style.display = 'flex';
        document.getElementById(positionId).style.opacity = '0.6';
    }

    refreshPodium() {
        console.log('Refreshing podium data...');
        this.loadPodiumData();
    }

    resetPodium() {
        console.log('Resetting podium to RFID input');
        this.winners = [];
        this.currentRFID = null;
        this.teamName = '';
        
        this.changeState('rfidInput');
    }

    changeState(newState) {
        console.log(`State change: ${this.currentState} → ${newState}`);
        
        // Debug: Log all states before hiding
        document.querySelectorAll('.podium-state-clean').forEach(state => {
            console.log(`State ${state.id}: active=${state.classList.contains('active')}`);
        });
        
        // Hide all states
        document.querySelectorAll('.podium-state-clean').forEach(state => {
            state.classList.remove('active');
        });
        
        // Show the new state
        let stateElement;
        switch (newState) {
            case 'rfidInput':
                stateElement = document.getElementById('rfidInputState');
                break;
            case 'loading':
                stateElement = document.getElementById('loadingState');
                break;
            case 'podium':
                stateElement = document.getElementById('podiumState');
                break;
            case 'error':
                stateElement = document.getElementById('errorState');
                break;
        }
        
        if (stateElement) {
            stateElement.classList.add('active');
            this.currentState = newState;
            console.log(`Activated state: ${newState}`);
        } else {
            console.error(`Could not find state element for: ${newState}`);
        }
        
        // Debug: Log all states after showing new one
        document.querySelectorAll('.podium-state-clean').forEach(state => {
            console.log(`After - State ${state.id}: active=${state.classList.contains('active')}`);
        });
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        this.changeState('error');
    }
}

// Global functions for HTML onclick handlers
function showPodium() {
    if (window.podiumManager) {
        window.podiumManager.showPodium();
    }
}

function resetPodium() {
    if (window.podiumManager) {
        window.podiumManager.resetPodium();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.podiumManager = new PodiumManager();
});

console.log('Podium script loaded');
