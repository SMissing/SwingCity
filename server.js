const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Import configuration and services
const { HOLES, GAME_CONFIG, HOLE_ASSIGNMENTS } = require('./config/holes');
const firebaseService = require('./services/firebaseRestService');
const OSCRouter = require('./services/oscRouter');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize OSC Router
const oscRouter = new OSCRouter();

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// In-memory game state (replace with Redis for production)
const gameState = {
  activeGames: new Map(), // rfid -> game session
  holeStates: new Map(),  // hole -> current game
  tablets: new Map()      // tabletId -> connection info
};

// ==================== ROUTES ====================

// Logo glow effect demo page
app.get('/logo-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo-glow-demo.html'));
});

// Homepage - redirect to admin dashboard
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Main tablet interface - shows hole-specific game
app.get('/tablet/:holeNumber', (req, res) => {
  const holeNumber = parseInt(req.params.holeNumber);
  
  // Validate hole number
  if (isNaN(holeNumber) || holeNumber < 1 || holeNumber > 12) {
    return res.status(404).render('error', {
      title: 'Hole Not Found',
      error: { message: `Hole number "${req.params.holeNumber}" is not valid. Must be 1-12.` }
    });
  }

  // Get hole configuration from HOLE_ASSIGNMENTS
  const holeNames = Object.keys(HOLES);
  const holeId = holeNames[holeNumber - 1]; // Convert 1-based to 0-based index
  const hole = HOLES[holeId];
  
  if (!hole) {
    return res.status(404).render('error', {
      title: 'Hole Not Found',
      error: { message: `No hole configuration found for hole ${holeNumber}` }
    });
  }

  // Add par calculation (default to 3 for now, can be customized per hole)
  const holeWithPar = {
    ...hole,
    par: 3 // Default par for mini golf
  };

  res.render('tablet', {
    title: `Hole ${holeNumber} - ${hole.displayName} - SwingCity`,
    hole: holeWithPar,
    holeId: holeId,
    holeNumber: holeNumber,
    config: GAME_CONFIG
  });
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.render('admin', {
    title: 'Admin Dashboard - SwingCity',
    holes: HOLES,
    gameState: {
      activeGames: Array.from(gameState.activeGames.entries()),
      holeStates: Array.from(gameState.holeStates.entries())
    }
  });
});

// Leaderboard display
app.get('/leaderboard', (req, res) => {
  res.render('leaderboard', {
    title: 'Leaderboard - SwingCity'
  });
});

// Podium display - shows top 3 winners
app.get('/podium', (req, res) => {
  res.render('podium', {
    title: 'Podium - SwingCity Winners'
  });
});

// Team Creator/Manager
app.get('/admin/teams', (req, res) => {
  res.render('team-creator', {
    title: 'Team Creator - SwingCity'
  });
});

// Redirect for backwards compatibility  
app.get('/team-creator', (req, res) => {
  res.redirect('/admin/teams');
});

// OSC Router Management
app.get('/admin/osc', (req, res) => {
  res.render('osc-manager', {
    title: 'OSC Router - SwingCity'
  });
});

// Get team data by RFID for leaderboard
app.get('/api/team/:rfid', async (req, res) => {
  const { rfid } = req.params;
  
  if (!rfid) {
    return res.status(400).json({ error: 'RFID required' });
  }

  try {
    const teamData = await firebaseService.getTeamByRFID(rfid);
    
    // Calculate totals
    teamData.totalScore = firebaseService.calculateTeamTotal(teamData.players);
    teamData.holesCompleted = firebaseService.calculateHolesCompleted(teamData.players);
    
    res.json(teamData);
  } catch (error) {
    console.error('Error fetching team data:', error.message);
    res.status(404).json({ 
      error: 'Team not found',
      message: error.message 
    });
  }
});

// Get leaderboard data
app.get('/api/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    const leaderboard = await firebaseService.getLeaderboard(limit);
    res.json({
      leaderboard: leaderboard,
      timestamp: new Date().toISOString(),
      totalTeams: leaderboard.length
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch leaderboard',
      message: error.message 
    });
  }
});

// Get top 3 players from a team for podium display
app.get('/api/podium/:rfid', async (req, res) => {
  const { rfid } = req.params;
  
  if (!rfid) {
    return res.status(400).json({ error: 'RFID required' });
  }

  try {
    const teamData = await firebaseService.getTeamByRFID(rfid);
    
    // Calculate total scores for each player and sort by best score (lowest in golf)
    const playersWithTotals = teamData.players.map(player => {
      const totalScore = firebaseService.calculatePlayerTotal(player);
      return {
        ...player,
        totalScore: totalScore
      };
    }).sort((a, b) => a.totalScore - b.totalScore); // Sort ascending (best golf score first)
    
    // Take top 3 players
    const top3Players = playersWithTotals.slice(0, 3);
    
    res.json({
      teamName: teamData.teamName,
      rfid: rfid,
      winners: top3Players,
      timestamp: new Date().toISOString(),
      totalWinners: top3Players.length
    });
  } catch (error) {
    console.error('Error fetching podium data for team:', error.message);
    res.status(404).json({ 
      error: 'Team not found',
      message: error.message 
    });
  }
});

// ==================== API ENDPOINTS ====================

// Health check
app.get('/api/health', async (req, res) => {
  // Test Firebase REST connection
  let firebaseStatus = { connected: false, error: 'Not tested' };
  try {
    const testData = await firebaseService.getLeaderboard(1);
    firebaseStatus = { 
      connected: true, 
      message: 'Firebase REST service healthy',
      teamsInDb: Array.isArray(testData) ? testData.length : 0
    };
  } catch (error) {
    firebaseStatus = { connected: false, error: error.message };
  }
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeGames: gameState.activeGames.size,
    connectedTablets: gameState.tablets.size,
    firebase: firebaseStatus
  });
});

// Get current game state for a hole
app.get('/api/hole/:holeNumber/state', (req, res) => {
  const holeNumber = parseInt(req.params.holeNumber);
  
  if (isNaN(holeNumber) || holeNumber < 1 || holeNumber > 12) {
    return res.status(400).json({ error: 'Invalid hole number' });
  }

  // Convert hole number to hole ID
  const holeNames = Object.keys(HOLES);
  const holeId = holeNames[holeNumber - 1];
  const holeState = gameState.holeStates.get(holeId);
  
  res.json({
    hole: holeNumber,
    holeId: holeId,
    state: holeState || null,
    config: HOLES[holeId] || null
  });
});

// RFID card tap endpoint (called by Raspberry Pi)
app.post('/api/rfid/tap', (req, res) => {
  const { rfid, holeId, picoId } = req.body;
  
  if (!rfid || !holeId) {
    return res.status(400).json({ error: 'Missing rfid or holeId' });
  }

  console.log(`📡 RFID Tap: ${rfid} at ${holeId} (Pico: ${picoId})`);
  
  // Handle the RFID tap
  handleRFIDTap(rfid, holeId, picoId);
  
  res.json({ 
    success: true, 
    message: 'RFID tap processed',
    timestamp: new Date().toISOString()
  });
});

// Score input endpoint (called by Raspberry Pi)
app.post('/api/score/input', (req, res) => {
  const { rfid, holeId, score, throwNumber, picoId } = req.body;
  
  if (rfid === undefined || !holeId || score === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log(`🎯 Score Input: ${score} points for ${rfid} at ${holeId} (throw ${throwNumber})`);
  
  // Handle the score input
  handleScoreInput(rfid, holeId, score, throwNumber, picoId);
  
  res.json({ 
    success: true, 
    message: 'Score recorded',
    timestamp: new Date().toISOString()
  });
});

// API endpoint to create/update a team
app.post('/api/teams', async (req, res) => {
  const { rfid, teamName, players } = req.body;
  
  if (!rfid || !teamName || !players || !Array.isArray(players)) {
    return res.status(400).json({ 
      error: 'Invalid data', 
      message: 'RFID, team name, and players array are required' 
    });
  }

  try {
    const teamData = await firebaseService.createOrUpdateTeam(rfid, teamName, players);
    res.json({ success: true, team: teamData });
  } catch (error) {
    console.error('Error creating/updating team:', error);
    res.status(500).json({ error: 'Failed to create team', message: error.message });
  }
});

// API endpoint to get all teams
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await firebaseService.getAllTeams();
    res.json({ teams, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams', message: error.message });
  }
});

// API endpoint to delete a team
app.delete('/api/teams/:rfid', async (req, res) => {
  const { rfid } = req.params;
  
  try {
    await firebaseService.deleteTeam(rfid);
    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team', message: error.message });
  }
});

// API endpoint to update a team
app.put('/api/teams/:rfid', async (req, res) => {
  const { rfid } = req.params;
  const { teamName, players } = req.body;
  
  try {
    // Validate input
    if (!teamName || !players || !Array.isArray(players)) {
      return res.status(400).json({ error: 'Team name and players array are required' });
    }
    
    if (players.length === 0) {
      return res.status(400).json({ error: 'At least one player is required' });
    }
    
    // Update the team
    await firebaseService.updateTeam(rfid, {
      teamName,
      players,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`📝 Updated team ${rfid}: ${teamName} with ${players.length} players`);
    res.json({ success: true, message: 'Team updated successfully' });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team', message: error.message });
  }
});

// ==================== OSC ROUTER API ENDPOINTS ====================

// Get OSC router status
app.get('/api/osc/status', (req, res) => {
  try {
    const status = oscRouter.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error getting OSC status:', error);
    res.status(500).json({ error: 'Failed to get OSC status', message: error.message });
  }
});

// Get server network information
app.get('/api/osc/network', (req, res) => {
  try {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    // Find the main network interface (usually WiFi or Ethernet)
    let serverIP = '127.0.0.1';
    
    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      if (interfaces) {
        for (const iface of interfaces) {
          // Skip loopback and non-IPv4 addresses
          if (!iface.internal && iface.family === 'IPv4') {
            // Prefer WiFi or Ethernet interfaces
            if (name.toLowerCase().includes('wifi') || 
                name.toLowerCase().includes('ethernet') || 
                name.toLowerCase().includes('en0') || 
                name.toLowerCase().includes('en1')) {
              serverIP = iface.address;
              break;
            }
            // Fallback to any non-internal IPv4 address
            if (serverIP === '127.0.0.1') {
              serverIP = iface.address;
            }
          }
        }
        if (serverIP !== '127.0.0.1') break;
      }
    }
    
    res.json({
      success: true,
      network: {
        serverIP: serverIP,
        oscPort: 57121,
        messageFormat: '/[hole_name]/score [value]',
        exampleMessage: '/plinko/score 100'
      }
    });
  } catch (error) {
    console.error('Error getting network info:', error);
    res.status(500).json({ error: 'Failed to get network info', message: error.message });
  }
});

// Get OSC routing table
app.get('/api/osc/routing', (req, res) => {
  try {
    const routingTable = oscRouter.getRoutingTable();
    res.json({
      success: true,
      routing: routingTable
    });
  } catch (error) {
    console.error('Error getting OSC routing table:', error);
    res.status(500).json({ error: 'Failed to get routing table', message: error.message });
  }
});

// Update OSC routing for a hole
app.put('/api/osc/routing/:holeName', (req, res) => {
  try {
    const { holeName } = req.params;
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    oscRouter.updateRouting(holeName, address);
    res.json({ 
      success: true, 
      message: `Routing updated for ${holeName}: ${address}` 
    });
  } catch (error) {
    console.error('Error updating OSC routing:', error);
    res.status(500).json({ error: 'Failed to update routing', message: error.message });
  }
});

// Restart OSC router
app.post('/api/osc/restart', (req, res) => {
  try {
    oscRouter.stop();
    setTimeout(() => {
      oscRouter.start(57121);
      res.json({ success: true, message: 'OSC Router restarted' });
    }, 1000);
  } catch (error) {
    console.error('Error restarting OSC router:', error);
    res.status(500).json({ error: 'Failed to restart OSC router', message: error.message });
  }
});

// Stop OSC router
app.post('/api/osc/stop', (req, res) => {
  try {
    oscRouter.stop();
    res.json({ success: true, message: 'OSC Router stopped' });
  } catch (error) {
    console.error('Error stopping OSC router:', error);
    res.status(500).json({ error: 'Failed to stop OSC router', message: error.message });
  }
});

// Start OSC router
app.post('/api/osc/start', (req, res) => {
  try {
    const port = req.body.port || 57121;
    oscRouter.start(port);
    res.json({ success: true, message: `OSC Router started on port ${port}` });
  } catch (error) {
    console.error('Error starting OSC router:', error);
    res.status(500).json({ error: 'Failed to start OSC router', message: error.message });
  }
});

// Get OSC message log
app.get('/api/osc/log', (req, res) => {
  try {
    const log = oscRouter.getMessageLog();
    res.json({
      success: true,
      log: log
    });
  } catch (error) {
    console.error('Error getting OSC log:', error);
    res.status(500).json({ error: 'Failed to get OSC log', message: error.message });
  }
});

// Clear OSC message log
app.post('/api/osc/log/clear', (req, res) => {
  try {
    oscRouter.clearMessageLog();
    res.json({ success: true, message: 'OSC log cleared' });
  } catch (error) {
    console.error('Error clearing OSC log:', error);
    res.status(500).json({ error: 'Failed to clear OSC log', message: error.message });
  }
});

// Reset a specific hole (end any active game)
app.post('/api/hole/:holeId/reset', (req, res) => {
  const { holeId } = req.params;
  
  console.log(`🔄 Resetting hole: ${holeId}`);
  
  // Find and end any active game at this hole
  const holeState = gameState.holeStates.get(holeId);
  if (holeState) {
    // Remove the active game
    gameState.activeGames.delete(holeState.rfid);
    gameState.holeStates.delete(holeId);
    
    console.log(`🛑 Ended game for RFID ${holeState.rfid} at ${holeId}`);
    
    // Notify the tablet to reset to waiting state
    broadcastToHole(holeId, 'game-reset', { holeId });
    
    // Notify all admin clients
    io.emit('hole-reset', { holeId });
  }
  
  res.json({ 
    success: true, 
    message: `Hole ${holeId} reset successfully`,
    timestamp: new Date().toISOString()
  });
});

// Reset all holes
app.post('/api/holes/reset-all', (req, res) => {
  console.log('🔄 Resetting ALL holes');
  
  // End all active games
  const resetHoles = [];
  for (const [holeId, holeState] of gameState.holeStates.entries()) {
    resetHoles.push(holeId);
    
    // Remove the active game
    if (holeState.rfid) {
      gameState.activeGames.delete(holeState.rfid);
    }
    
    // Notify the tablet to reset
    broadcastToHole(holeId, 'game-reset', { holeId });
  }
  
  // Clear all hole states
  gameState.holeStates.clear();
  gameState.activeGames.clear();
  
  // Notify all admin clients
  io.emit('all-holes-reset', { resetHoles });
  
  console.log(`🛑 Reset ${resetHoles.length} holes:`, resetHoles);
  
  res.json({ 
    success: true, 
    message: `Reset ${resetHoles.length} holes successfully`,
    resetHoles,
    timestamp: new Date().toISOString()
  });
});

// ==================== API ENDPOINTS ====================

// Get current active games
app.get('/api/games/active', (req, res) => {
  const activeGames = Array.from(gameState.activeGames.entries()).map(([rfid, game]) => ({
    rfid,
    holeId: game.holeId,
    teamName: game.teamName,
    currentPlayer: game.players[game.currentPlayerIndex],
    currentPlayerIndex: game.currentPlayerIndex,
    currentThrow: game.currentThrow,
    status: game.status,
    startTime: game.startTime,
    lastActivity: game.lastActivity
  }));
  
  const holeStates = Array.from(gameState.holeStates.entries()).map(([holeId, state]) => ({
    holeId,
    status: state.status || 'idle',
    rfid: state.rfid,
    teamName: state.teamName,
    currentPlayer: state.players && state.players[state.currentPlayerIndex],
    lastActivity: state.lastActivity
  }));
  
  res.json({
    activeGames,
    holeStates,
    summary: {
      totalActiveGames: activeGames.length,
      connectedTablets: gameState.tablets.size,
      timestamp: new Date().toISOString()
    }
  });
});

// ==================== SOCKET.IO HANDLERS ====================

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Tablet registration
  socket.on('tablet-register', (data) => {
    const { holeId, tabletId } = data;
    gameState.tablets.set(tabletId || socket.id, {
      socketId: socket.id,
      holeId: holeId,
      connectedAt: new Date()
    });
    
    console.log(`📱 Tablet registered: ${holeId} (${tabletId || socket.id})`);
    
    // Send current hole state
    const holeState = gameState.holeStates.get(holeId);
    socket.emit('hole-state-update', holeState);
  });

  socket.on('disconnect', () => {
    // Clean up tablet registration
    for (let [tabletId, info] of gameState.tablets.entries()) {
      if (info.socketId === socket.id) {
        gameState.tablets.delete(tabletId);
        console.log(`📱 Tablet disconnected: ${tabletId}`);
        break;
      }
    }
  });

  // OSC Manager subscription
  socket.on('subscribe-osc-log', () => {
    console.log('🎵 Client subscribed to OSC log updates');
    socket.join('osc-log');
  });

  socket.on('unsubscribe-osc-log', () => {
    console.log('🎵 Client unsubscribed from OSC log updates');
    socket.leave('osc-log');
  });
});

// ==================== GAME LOGIC ====================

function handleRFIDTap(rfid, holeId, picoId) {
  // Check if there's already an active game at this hole
  const existingHoleState = gameState.holeStates.get(holeId);
  if (existingHoleState && existingHoleState.status === 'playing') {
    console.log(`⚠️ Hole ${holeId} busy, ignoring RFID tap`);
    return;
  }

  // Create game session (will fetch team data from Firebase)
  createGameSession(rfid, holeId).then(gameSession => {
    if (gameSession) {
      // Store the active game
      gameState.activeGames.set(rfid, gameSession);
      gameState.holeStates.set(holeId, gameSession);
      
      // Notify the tablet
      broadcastToHole(holeId, 'game-started', gameSession);
      
      console.log(`🎮 Game started: ${rfid} at ${holeId}`);
    }
  }).catch(error => {
    console.error(`❌ Failed to start game for ${rfid}:`, error.message);
  });
}

function handleScoreInput(rfid, holeId, score, throwNumber, picoId) {
  const gameSession = gameState.activeGames.get(rfid);
  
  if (!gameSession) {
    console.log(`⚠️ No active game for RFID ${rfid}`);
    return;
  }

  if (gameSession.holeId !== holeId) {
    console.log(`⚠️ RFID ${rfid} not at expected hole ${gameSession.holeId}`);
    return;
  }

  // Update the game session with the score
  updateGameScore(gameSession, score, throwNumber);
  
  // Broadcast the update
  broadcastToHole(holeId, 'score-update', gameSession);
  
  // Check if the current player is done
  checkPlayerComplete(gameSession, holeId);
}

async function createGameSession(rfid, holeId) {
  try {
    // Try to get team data from Firebase
    const teamData = await firebaseService.getTeamByRFID(rfid);
    
    return {
      rfid: rfid,
      holeId: holeId,
      teamName: teamData.teamName,
      players: teamData.players.map(player => ({
        id: player.id,
        name: player.name,
        scores: player.scores || {}
      })),
      currentPlayerIndex: 0,
      currentThrow: 0,
      status: 'playing',
      startTime: new Date(),
      lastActivity: new Date()
    };
  } catch (error) {
    console.error(`⚠️ Team ${rfid} not found in Firebase, creating new team`);
    
    // Create a new team if not found
    const newTeamData = {
      rfid: rfid,
      teamName: `Team ${rfid.slice(-4).toUpperCase()}`,
      players: [
        { id: `${rfid}_player1`, name: 'Player 1', scores: {} },
        { id: `${rfid}_player2`, name: 'Player 2', scores: {} }
      ]
    };
    
    // Save the new team to Firebase
    try {
      await firebaseService.saveTeam(newTeamData);
    } catch (saveError) {
      console.error('Failed to save new team:', saveError.message);
    }
    
    return {
      rfid: rfid,
      holeId: holeId,
      teamName: newTeamData.teamName,
      players: newTeamData.players,
      currentPlayerIndex: 0,
      currentThrow: 0,
      status: 'playing',
      startTime: new Date(),
      lastActivity: new Date()
    };
  }
}

function updateGameScore(gameSession, score, throwNumber) {
  const currentPlayer = gameSession.players[gameSession.currentPlayerIndex];
  
  // Ensure scores object exists and has the right structure
  if (!currentPlayer.scores[gameSession.holeId]) {
    currentPlayer.scores[gameSession.holeId] = {
      throws: [],
      total: 0
    };
  }

  // Add the throw score
  currentPlayer.scores[gameSession.holeId].throws.push(score);
  currentPlayer.scores[gameSession.holeId].total += score;
  
  gameSession.currentThrow++;
  gameSession.lastActivity = new Date();

  // Save score to Firebase
  firebaseService.savePlayerScore(
    currentPlayer.id, 
    gameSession.holeId, 
    currentPlayer.scores[gameSession.holeId]
  ).catch(error => {
    console.error('Failed to save score to Firebase:', error.message);
  });
}

function checkPlayerComplete(gameSession, holeId) {
  const currentPlayer = gameSession.players[gameSession.currentPlayerIndex];
  const maxThrows = GAME_CONFIG.MAX_THROWS;
  
  if (gameSession.currentThrow >= maxThrows) {
    // Current player is done
    console.log(`✅ Player ${currentPlayer.name} completed ${holeId}`);
    
    gameSession.currentPlayerIndex++;
    gameSession.currentThrow = 0;
    
    if (gameSession.currentPlayerIndex >= gameSession.players.length) {
      // All players done - complete the hole
      completeHole(gameSession, holeId);
    } else {
      // Next player's turn
      broadcastToHole(holeId, 'next-player', gameSession);
    }
  }
}

function completeHole(gameSession, holeId) {
  console.log(`🏁 Hole ${holeId} completed for team ${gameSession.rfid}`);
  
  // Save final game session to Firebase
  firebaseService.saveGameSession(gameSession).catch(error => {
    console.error('Failed to save game session:', error.message);
  });
  
  // Clean up game state
  gameState.activeGames.delete(gameSession.rfid);
  gameState.holeStates.delete(holeId);
  
  // Remove from active sessions in Firebase
  firebaseService.removeGameSession(gameSession.rfid).catch(error => {
    console.error('Failed to remove game session:', error.message);
  });
  
  // Notify tablet
  broadcastToHole(holeId, 'game-complete', gameSession);
}

function broadcastToHole(holeId, event, data) {
  // Find tablets for this hole
  for (let [tabletId, info] of gameState.tablets.entries()) {
    if (info.holeId === holeId) {
      io.to(info.socketId).emit(event, data);
    }
  }
}

// ==================== ERROR HANDLERS ====================

app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Error - SwingCity V2',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ==================== SERVER START ====================

// Initialize Firebase and start server
async function startServer() {
  try {
    // Initialize Firebase REST service
    await firebaseService.initialize();
    
    // Test Firebase REST connection (skip the problematic Admin SDK test)
    let firebaseStatus = { connected: false, error: 'Not tested' };
    try {
      // Test with a simple REST API call to verify connectivity
      const testData = await firebaseService.getLeaderboard(3);
      firebaseStatus = { 
        connected: true, 
        message: 'Firebase REST service connected successfully',
        teamsFound: Array.isArray(testData) ? testData.length : 0
      };
      console.log('🔥 Firebase REST service connected successfully');
      console.log(`📊 Found ${firebaseStatus.teamsFound} teams in leaderboard`);
    } catch (error) {
      firebaseStatus = { connected: false, error: error.message };
      console.log('⚠️ Firebase REST connection failed, running in fallback mode');
      console.log('Error:', firebaseStatus.error);
    }
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 SwingCity V2 Crazy Golf System running on http://localhost:${PORT}`);
      console.log(`📅 Started at: ${new Date().toISOString()}`);
      console.log(`🎯 Configured holes: ${Object.keys(HOLES).length}`);
      console.log(`📱 Max concurrent teams: ${GAME_CONFIG.MAX_CONCURRENT_TEAMS}`);
      console.log(`🔥 Firebase status: ${firebaseStatus.connected ? 'Connected via REST' : 'Fallback Mode'}`);
      
      // Start OSC Router after main server is running
      try {
        oscRouter.start(57121); // Use port 57121 for OSC (same as original script)
        console.log('🎵 OSC Router integrated and started');
        
        // Set up OSC event listeners for real-time web updates
        oscRouter.on('message', (logEntry) => {
          io.to('osc-log').emit('osc-message', logEntry);
        });
        
        oscRouter.on('logCleared', () => {
          io.to('osc-log').emit('osc-log-cleared');
        });
        
      } catch (error) {
        console.error('⚠️ Failed to start OSC Router:', error.message);
        console.log('   Server will continue without OSC routing functionality');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// ==================== GRACEFUL SHUTDOWN ====================

// Handle graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  // Stop OSC Router
  if (oscRouter) {
    try {
      oscRouter.stop();
      console.log('🎵 OSC Router stopped');
    } catch (error) {
      console.error('⚠️ Error stopping OSC Router:', error.message);
    }
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('🚀 HTTP server closed');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unity FEEL Demo page
app.get('/unity-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'unity-feel-demo.html'));
});

// Image Auto-Crop Demo page
app.get('/crop-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'image-crop-demo.html'));
});

// End a specific game by RFID
app.post('/api/game/end', (req, res) => {
  const { rfid } = req.body;
  
  if (!rfid) {
    return res.status(400).json({ error: 'RFID is required' });
  }
  
  const gameSession = gameState.activeGames.get(rfid);
  if (!gameSession) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  const holeId = gameSession.holeId;
  
  console.log(`🛑 Admin ending game: RFID ${rfid} at ${holeId}`);
  
  // Remove the game from active games
  gameState.activeGames.delete(rfid);
  gameState.holeStates.delete(holeId);
  
  // Notify the tablet to reset
  broadcastToHole(holeId, 'game-reset', { holeId, reason: 'Admin ended game' });
  
  // Notify all admin clients
  io.emit('game-ended', { rfid, holeId, reason: 'Admin action' });
  
  res.json({ 
    success: true, 
    message: `Game ended for RFID ${rfid}`,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
