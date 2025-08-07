// Team Creator JavaScript
let playerCount = 0;
let scanTimeout = null;
let currentDeleteRfid = null;

// Initialize the team creator
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupRFIDScanning();
    addInitialPlayer();
    loadExistingTeams();
    
    // Start with RFID scanning disabled
    if (window.toggleRFIDScanning) {
        window.toggleRFIDScanning(false);
    }
});

function setupEventListeners() {
    // Form submission
    document.getElementById('teamCreatorForm').addEventListener('submit', handleTeamCreation);
    
    // Add player button
    document.getElementById('addPlayerBtn').addEventListener('click', addPlayer);
    
    // Clear form button
    document.getElementById('clearFormBtn').addEventListener('click', clearForm);
    
    // Scan RFID button
    document.getElementById('scanRfidBtn').addEventListener('click', focusRFIDInput);
    
    // Refresh teams button
    document.getElementById('refreshTeamsBtn').addEventListener('click', loadExistingTeams);
    
    // Confirm delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', executeDelete);
    
    // Save team changes button
    document.getElementById('saveTeamChangesBtn').addEventListener('click', saveTeamChanges);
    
    // Auto-generate team name from RFID
    document.getElementById('rfid').addEventListener('input', function(e) {
        const rfid = e.target.value.trim();
        const teamNameInput = document.getElementById('teamName');
        
        if (rfid && !teamNameInput.value) {
            teamNameInput.value = `Team ${rfid.slice(-4)}`;
        }
    });
}

function setupRFIDScanning() {
    const hiddenInput = document.getElementById('hiddenRfidInput');
    
    // Keep focus on hidden input for RFID scanning
    hiddenInput.focus();
    
    // Handle RFID input
    hiddenInput.addEventListener('input', function(e) {
        const value = e.target.value.trim();
        
        // Clear any existing timeout
        if (scanTimeout) {
            clearTimeout(scanTimeout);
        }
        
        // Set timeout to process the input
        scanTimeout = setTimeout(() => {
            if (value.length >= 8) {
                processRFIDScan(value);
                hiddenInput.value = '';
            }
        }, 100);
    });
    
    // Handle Enter key
    hiddenInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const value = e.target.value.trim();
            if (value.length >= 8) {
                processRFIDScan(value);
                hiddenInput.value = '';
            }
        }
    });
    
    // Only refocus when RFID scanning is actively enabled
    let rfidScanningActive = false;
    
    document.addEventListener('click', function(e) {
        // Only refocus if RFID scanning is active and the click wasn't on a form element
        if (rfidScanningActive && !e.target.matches('input, button, select, textarea, a, .btn')) {
            setTimeout(() => hiddenInput.focus(), 100);
        }
    });
    
    // Function to enable/disable RFID scanning
    window.toggleRFIDScanning = function(active) {
        rfidScanningActive = active;
        if (active) {
            hiddenInput.focus();
        }
    };
}

function focusRFIDInput() {
    window.toggleRFIDScanning(true);
    showSuccess('RFID scanner is ready. Tap your card now.');
}

function processRFIDScan(rfid) {
    console.log('RFID Scanned:', rfid);
    
    // Set the RFID in the form
    const rfidInput = document.getElementById('rfid');
    rfidInput.value = rfid;
    rfidInput.dispatchEvent(new Event('input')); // Trigger team name generation
    
    // Visual feedback
    rfidInput.classList.add('highlight-success');
    setTimeout(() => {
        rfidInput.classList.remove('highlight-success');
    }, 2000);
    
    // Disable RFID scanning after successful scan
    window.toggleRFIDScanning(false);
    
    showSuccess(`RFID ${rfid} scanned successfully!`);
}

function addPlayer(playerData = null) {
    playerCount++;
    const playersContainer = document.getElementById('playersContainer');
    
    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-form';
    playerDiv.dataset.playerId = playerCount;
    
    const name = playerData ? playerData.name : '';
    const email = playerData ? playerData.email : '';
    
    playerDiv.innerHTML = `
        <div class="player-header">
            <h4>Player ${playerCount}</h4>
            <button type="button" class="btn btn-danger btn-sm remove-player-btn" onclick="removePlayer(${playerCount})">
                🗑️ Remove
            </button>
        </div>
        <div class="player-inputs">
            <div class="form-group">
                <label>Display Name:</label>
                <input type="text" name="playerName" class="form-control" placeholder="Enter player name" value="${name}" required>
            </div>
            <div class="form-group">
                <label>Email Address:</label>
                <input type="email" name="playerEmail" class="form-control" placeholder="player@example.com" value="${email}" required>
                <small class="form-text">Used as unique identifier for the player</small>
            </div>
        </div>
    `;
    
    playersContainer.appendChild(playerDiv);
    
    // Focus on the name input for new players
    if (!playerData) {
        playerDiv.querySelector('input[name="playerName"]').focus();
    }
}

function addInitialPlayer() {
    addPlayer();
}

function removePlayer(playerId) {
    const playerDiv = document.querySelector(`[data-player-id="${playerId}"]`);
    if (playerDiv) {
        playerDiv.remove();
        
        // If no players left, add one
        if (document.querySelectorAll('.player-form').length === 0) {
            addInitialPlayer();
        }
        
        // Renumber players
        renumberPlayers();
    }
}

function renumberPlayers() {
    const playerForms = document.querySelectorAll('.player-form');
    playerForms.forEach((form, index) => {
        const header = form.querySelector('.player-header h4');
        header.textContent = `Player ${index + 1}`;
    });
}

function clearForm() {
    document.getElementById('rfid').value = '';
    document.getElementById('teamName').value = '';
    
    // Remove all players and add one fresh one
    document.getElementById('playersContainer').innerHTML = '';
    playerCount = 0;
    addInitialPlayer();
}

async function handleTeamCreation(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const rfid = formData.get('rfid').trim();
    const teamName = formData.get('teamName').trim();
    
    // Collect players
    const players = [];
    const playerForms = document.querySelectorAll('.player-form');
    
    for (let form of playerForms) {
        const name = form.querySelector('input[name="playerName"]').value.trim();
        const email = form.querySelector('input[name="playerEmail"]').value.trim();
        
        if (name && email) {
            players.push({ name, email });
        }
    }
    
    // Validation
    if (!rfid || rfid.length < 8) {
        showError('Please provide a valid RFID (at least 8 characters)');
        return;
    }
    
    if (!teamName) {
        showError('Please provide a team name');
        return;
    }
    
    if (players.length === 0) {
        showError('Please add at least one player');
        return;
    }
    
    // Check for duplicate emails
    const emails = players.map(p => p.email.toLowerCase());
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
        showError('Each player must have a unique email address');
        return;
    }
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating Team...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/teams', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                rfid: rfid,
                teamName: teamName,
                players: players
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess(`Team "${teamName}" created successfully with RFID ${rfid}!`);
            clearForm();
            loadExistingTeams();
        } else {
            throw new Error(result.message || 'Failed to create team');
        }
    } catch (error) {
        console.error('Error creating team:', error);
        showError('Failed to create team: ' + error.message);
    } finally {
        // Restore button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function loadExistingTeams() {
    const loadingIndicator = document.getElementById('teamsLoadingIndicator');
    const teamsTable = document.getElementById('teamsTable');
    const noTeamsMessage = document.getElementById('noTeamsMessage');
    
    // Show loading state
    loadingIndicator.style.display = 'block';
    teamsTable.style.display = 'none';
    noTeamsMessage.style.display = 'none';
    
    try {
        const response = await fetch('/api/teams');
        const data = await response.json();
        
        if (response.ok && data.teams) {
            if (data.teams.length === 0) {
                noTeamsMessage.style.display = 'block';
            } else {
                displayTeams(data.teams);
                teamsTable.style.display = 'block';
            }
        } else {
            throw new Error('Failed to load teams');
        }
    } catch (error) {
        console.error('Error loading teams:', error);
        showError('Failed to load teams: ' + error.message);
        noTeamsMessage.style.display = 'block';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function displayTeams(teams) {
    const teamsTable = document.getElementById('teamsTable');
    
    let html = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>RFID</th>
                    <th>Team Name</th>
                    <th>Players</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    teams.forEach(team => {
        const playersList = team.players.map(p => `<span class="player-tag">${p.name}</span>`).join(' ');
        const createdDate = team.created ? new Date(team.created).toLocaleDateString() : 'Unknown';
        
        html += `
            <tr>
                <td><code>${team.rfid}</code></td>
                <td><strong>${team.teamName}</strong></td>
                <td class="players-list">${playersList}</td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editTeam('${team.rfid}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteTeam('${team.rfid}', '${team.teamName}')">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    teamsTable.innerHTML = html;
}

async function editTeam(rfid) {
    try {
        // Show loading in modal
        document.getElementById('editTeamContent').innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary"></div>
                <p class="mt-2">Loading team data...</p>
            </div>
        `;
        
        // Show the modal
        const modal = new bootstrap.Modal(document.getElementById('editTeamModal'));
        modal.show();
        
        // Fetch detailed team data
        const response = await fetch(`/api/team/${rfid}`);
        const teamData = await response.json();
        
        if (!response.ok) {
            throw new Error(teamData.message || 'Failed to load team data');
        }
        
        // Render the edit form
        renderEditForm(teamData);
        
    } catch (error) {
        console.error('Error loading team for edit:', error);
        document.getElementById('editTeamContent').innerHTML = `
            <div class="alert alert-danger">
                <strong>Error:</strong> ${error.message}
            </div>
        `;
    }
}

function confirmDeleteTeam(rfid, teamName) {
    currentDeleteRfid = rfid;
    
    const deleteTeamInfo = document.getElementById('deleteTeamInfo');
    deleteTeamInfo.innerHTML = `
        <strong>Team:</strong> ${teamName}<br>
        <strong>RFID:</strong> ${rfid}
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
    modal.show();
}

async function executeDelete() {
    if (!currentDeleteRfid) return;
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Deleting...';
    confirmBtn.disabled = true;
    
    try {
        const response = await fetch(`/api/teams/${currentDeleteRfid}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Team deleted successfully!');
            loadExistingTeams();
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
            modal.hide();
        } else {
            throw new Error(result.message || 'Failed to delete team');
        }
    } catch (error) {
        console.error('Error deleting team:', error);
        showError('Failed to delete team: ' + error.message);
    } finally {
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
        currentDeleteRfid = null;
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

// Utility function to add visual feedback to form elements
function addHighlight(element, type = 'success') {
    element.classList.add(`highlight-${type}`);
    setTimeout(() => {
        element.classList.remove(`highlight-${type}`);
    }, 2000);
}

function renderEditForm(teamData) {
    const holes = ['Plinko', 'SpinningTop', 'Haphazard', 'HillHop', 'Igloo', 'LoopDeLoop', 'Lopside', 'Lopsided', 'Mastermind', 'Octagon', 'Roundhouse', 'SkiJump', 'UpAndOver'];
    
    let html = `
        <form id="editTeamForm">
            <input type="hidden" id="editTeamRfid" value="${teamData.rfid}">
            
            <!-- Team Basic Info -->
            <div class="row mb-4">
                <div class="col-md-6">
                    <label class="form-label">RFID:</label>
                    <input type="text" class="form-control" value="${teamData.rfid}" readonly>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Team Name:</label>
                    <input type="text" id="editTeamName" class="form-control" value="${teamData.teamName}" required>
                </div>
            </div>
            
            <!-- Players and Scores -->
            <h5 class="mb-3">👥 Players & Scores</h5>
    `;
    
    teamData.players.forEach((player, playerIndex) => {
        html += `
            <div class="player-edit-section mb-4" data-player-id="${player.id}">
                <div class="card">
                    <div class="card-header">
                        <div class="row">
                            <div class="col-md-6">
                                <label class="form-label">Player Name:</label>
                                <input type="text" class="form-control player-name" value="${player.name}" required>
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">Player ID:</label>
                                <input type="text" class="form-control player-email" value="${player.id}" readonly>
                                <small class="text-muted">Player identifier cannot be changed</small>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        <h6>🎯 Hole Scores</h6>
                        <div class="row">
        `;
        
        holes.forEach(hole => {
            // Safely get the score for this specific hole, ensuring zero scores are preserved
            let score = 0;
            if (player.scores && player.scores[hole] && player.scores[hole].total !== undefined && player.scores[hole].total !== null) {
                score = Number(player.scores[hole].total);
            }
            
            html += `
                <div class="col-md-3 col-sm-6 mb-3">
                    <label class="form-label">${hole}:</label>
                    <input type="number" class="form-control hole-score" 
                           data-hole="${hole}" 
                           value="${score}" 
                           placeholder="0"
                           step="25">
                </div>
            `;
        });
        
        const totalScore = Object.values(player.scores || {}).reduce((sum, hole) => sum + (hole.total || 0), 0);
        
        html += `
                        </div>
                        <div class="mt-3 p-3 bg-light rounded">
                            <strong>Player Total: <span class="player-total-score">${totalScore}</span> points</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    const teamTotal = teamData.players.reduce((sum, player) => {
        return sum + Object.values(player.scores || {}).reduce((playerSum, hole) => playerSum + (hole.total || 0), 0);
    }, 0);
    
    html += `
            <div class="team-totals mt-4 p-3 bg-primary text-white rounded">
                <h5>🏆 Team Total: <span id="teamTotalScore">${teamTotal}</span> points</h5>
                <small>Holes Completed: ${teamData.holesCompleted || 0}</small>
            </div>
        </form>
    `;
    
    document.getElementById('editTeamContent').innerHTML = html;
    
    // Add event listeners for real-time score calculation
    addScoreCalculationListeners();
}

function addScoreCalculationListeners() {
    const scoreInputs = document.querySelectorAll('.hole-score');
    
    scoreInputs.forEach(input => {
        input.addEventListener('input', function() {
            updateScoreTotals();
        });
    });
}

function updateScoreTotals() {
    const playerSections = document.querySelectorAll('.player-edit-section');
    let teamTotal = 0;
    
    playerSections.forEach(section => {
        const scoreInputs = section.querySelectorAll('.hole-score');
        let playerTotal = 0;
        
        scoreInputs.forEach(input => {
            const score = parseInt(input.value) || 0;
            playerTotal += score;
        });
        
        section.querySelector('.player-total-score').textContent = playerTotal;
        teamTotal += playerTotal;
    });
    
    document.getElementById('teamTotalScore').textContent = teamTotal;
}

async function saveTeamChanges() {
    const saveBtn = document.getElementById('saveTeamChangesBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        // Show loading state
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        saveBtn.disabled = true;
        
        // Collect form data
        const rfid = document.getElementById('editTeamRfid').value;
        const teamName = document.getElementById('editTeamName').value.trim();
        
        if (!teamName) {
            throw new Error('Team name is required');
        }
        
        // Collect player data
        const players = [];
        const playerSections = document.querySelectorAll('.player-edit-section');
        
        playerSections.forEach(section => {
            const playerId = section.dataset.playerId;
            const playerName = section.querySelector('.player-name').value.trim();
            const playerEmail = section.querySelector('.player-email').value.trim();
            
            if (!playerName) {
                throw new Error('All player names are required');
            }
            
            // Collect hole scores
            const scores = {};
            const scoreInputs = section.querySelectorAll('.hole-score');
            
            scoreInputs.forEach(input => {
                const hole = input.dataset.hole;
                const scoreValue = input.value.trim();
                const score = scoreValue === '' ? 0 : parseInt(scoreValue, 10) || 0;
                
                // Always save the score, even if it's 0
                scores[hole] = {
                    throws: [], // Keep empty for now, could be enhanced later
                    total: score
                };
            });
  
            players.push({
                id: playerId,
                name: playerName,
                email: playerEmail,
                scores: scores
            });
        });
        
        // Prepare update data
        const updateData = {
            teamName: teamName,
            players: players
        };
        
        // Send update request
        const response = await fetch(`/api/teams/${rfid}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to update team');
        }
        
        // Success - close modal and refresh
        showSuccess(`Team "${teamName}" updated successfully!`);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('editTeamModal'));
        modal.hide();
        
        // Refresh the teams list
        loadExistingTeams();
        
    } catch (error) {
        console.error('Error saving team changes:', error);
        showError('Failed to save changes: ' + error.message);
    } finally {
        // Restore button state
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}
