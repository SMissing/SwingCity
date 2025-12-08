const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Import services
const firebaseService = require('./services/firebaseRestService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================== ROUTES ====================

// Homepage - Dashboard
app.get('/', (req, res) => {
  res.render('dashboard', {
    title: 'SwingCity - Dashboard'
  });
});

// Leaderboard display
app.get('/leaderboard', (req, res) => {
  res.render('leaderboard', {
    title: 'Leaderboard - SwingCity'
  });
});

// All-Time High Scores display
app.get('/highscores', (req, res) => {
  res.render('highscores', {
    title: 'All-Time High Scores - SwingCity'
  });
});

// Podium display - shows top 3 winners
app.get('/podium', (req, res) => {
  res.render('podium', {
    title: 'Podium - SwingCity Winners'
  });
});

// Team Creator/Manager
app.get('/teams', (req, res) => {
  res.render('team-creator', {
    title: 'Team Creator - SwingCity'
  });
});

// App Download page
app.get('/download', (req, res) => {
  res.render('download', {
    title: 'App Download - SwingCity'
  });
});

// Training page
app.get('/training', (req, res) => {
  res.render('training', {
    title: 'Training - SwingCity'
  });
});

// API to list downloadable files
app.get('/api/downloads', (req, res) => {
  const fs = require('fs');
  const downloadsPath = path.join(__dirname, 'public', 'downloads');
  
  try {
    const files = fs.readdirSync(downloadsPath)
      .filter(file => !file.startsWith('.')) // Exclude hidden files like .gitkeep
      .map(file => {
        const filePath = path.join(downloadsPath, file);
        const stats = fs.statSync(filePath);
        const ext = path.extname(file).toLowerCase();
        
        // Determine file type for icon
        let type = 'file';
        if (ext === '.apk') type = 'android';
        else if (['.zip', '.rar', '.7z'].includes(ext)) type = 'archive';
        else if (['.pdf'].includes(ext)) type = 'document';
        else if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) type = 'image';
        
        return {
          name: file,
          size: stats.size,
          sizeFormatted: formatFileSize(stats.size),
          modified: stats.mtime,
          modifiedFormatted: stats.mtime.toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          }),
          type: type,
          url: `/downloads/${encodeURIComponent(file)}`
        };
      })
      .sort((a, b) => b.modified - a.modified); // Most recent first
    
    res.json({ files, count: files.length });
  } catch (error) {
    console.error('Error listing downloads:', error);
    res.json({ files: [], count: 0, error: error.message });
  }
});

// Helper function to format file sizes
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Backwards compatibility redirects
app.get('/admin/teams', (req, res) => {
  res.redirect('/teams');
});

app.get('/team-creator', (req, res) => {
  res.redirect('/teams');
});

// ==================== API ENDPOINTS ====================

// PIN verification for dashboard access
app.post('/api/verify-pin', (req, res) => {
  const { pin } = req.body;
  const sitePin = process.env.SITE_PIN || '5656';
  
  if (!pin) {
    return res.status(400).json({ success: false, message: 'PIN required' });
  }
  
  if (pin === sitePin) {
    res.json({ success: true, message: 'Access granted' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid PIN' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
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
    firebase: firebaseStatus
  });
});

// Get team data by RFID
app.get('/api/team/:rfid', async (req, res) => {
  const { rfid } = req.params;
  
  if (!rfid) {
    return res.status(400).json({ error: 'RFID required' });
  }

  try {
    const teamData = await firebaseService.getTeamByRFID(rfid);
    
    // Calculate totals (holesCompleted object comes from getTeamByRFID, don't overwrite it)
    teamData.totalScore = firebaseService.calculateTeamTotal(teamData.players);
    teamData.holesCompletedCount = firebaseService.calculateHolesCompleted(teamData.players);
    
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
  const limit = parseInt(req.query.limit) || 25;
  
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

// Get top high scores (players who completed all 12 holes)
app.get('/api/highscores', async (req, res) => {
  const limit = parseInt(req.query.limit) || 25;
  
  try {
    const highScores = await firebaseService.getTopHighScores(limit);
    res.json({
      highScores: highScores,
      timestamp: new Date().toISOString(),
      total: highScores.length
    });
  } catch (error) {
    console.error('Error fetching high scores:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch high scores',
      message: error.message 
    });
  }
});

// Save a high score manually (for admin use or Unity)
app.post('/api/highscores', async (req, res) => {
  const { playerId, playerName, totalScore, rfid } = req.body;
  
  if (!playerId || !playerName || totalScore === undefined) {
    return res.status(400).json({ 
      error: 'Invalid data', 
      message: 'playerId, playerName, and totalScore are required' 
    });
  }

  try {
    const result = await firebaseService.saveHighScore(playerId, playerName, totalScore, rfid);
    io.emit('highScoreUpdated', { playerId, playerName, totalScore });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error saving high score:', error.message);
    res.status(500).json({ 
      error: 'Failed to save high score',
      message: error.message 
    });
  }
});

// Sync all players to high scores
app.post('/api/highscores/sync', async (req, res) => {
  try {
    const result = await firebaseService.syncAllPlayersToHighScores();
    io.emit('highScoreUpdated', { source: 'sync' });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error syncing high scores:', error.message);
    res.status(500).json({ 
      error: 'Failed to sync high scores',
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

// ==================== TEAM API ENDPOINTS ====================

// Create/update a team
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
    io.emit('teamUpdated', { rfid, teamName });
    res.json({ success: true, team: teamData });
  } catch (error) {
    console.error('Error creating/updating team:', error);
    res.status(500).json({ error: 'Failed to create team', message: error.message });
  }
});

// Get all teams
app.get('/api/teams', async (req, res) => {
  try {
    const teams = await firebaseService.getAllTeams();
    res.json({ teams, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams', message: error.message });
  }
});

// Delete a team
app.delete('/api/teams/:rfid', async (req, res) => {
  const { rfid } = req.params;
  
  try {
    await firebaseService.deleteTeam(rfid);
    io.emit('teamDeleted', { rfid });
    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team', message: error.message });
  }
});

// Update a team
app.put('/api/teams/:rfid', async (req, res) => {
  const { rfid } = req.params;
  const { teamName, players, holesCompleted } = req.body;
  
  try {
    if (!teamName || !players || !Array.isArray(players)) {
      return res.status(400).json({ error: 'Team name and players array are required' });
    }
    
    if (players.length === 0) {
      return res.status(400).json({ error: 'At least one player is required' });
    }
    
    await firebaseService.updateTeam(rfid, {
      teamName,
      players,
      holesCompleted,
      lastUpdated: new Date().toISOString()
    });
    
    console.log(`📝 Updated team ${rfid}: ${teamName} with ${players.length} players`);
    io.emit('teamUpdated', { rfid, teamName });
    res.json({ success: true, message: 'Team updated successfully' });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team', message: error.message });
  }
});

// ==================== UNITY INTEGRATION API ====================
// These endpoints allow Unity to update scores and trigger UI updates

// Update player score from Unity
app.post('/api/unity/score', async (req, res) => {
  const { rfid, playerId, holeId, score, throws } = req.body;
  
  if (!rfid || !playerId || !holeId || score === undefined) {
    return res.status(400).json({ 
      error: 'Invalid data', 
      message: 'rfid, playerId, holeId, and score are required' 
    });
  }

  try {
    await firebaseService.savePlayerScore(playerId, holeId, {
      throws: throws || [score],
      total: score,
      timestamp: new Date().toISOString()
    });
    
    // Broadcast update to all connected clients (leaderboards, etc.)
    io.emit('scoreUpdated', { rfid, playerId, holeId, score });
    
    res.json({ success: true, message: 'Score recorded' });
  } catch (error) {
    console.error('Error saving Unity score:', error.message);
    res.status(500).json({ error: 'Failed to save score', message: error.message });
  }
});

// Trigger leaderboard refresh from Unity (after game completion)
app.post('/api/unity/refresh-leaderboard', async (req, res) => {
  try {
    // Sync high scores
    await firebaseService.syncAllPlayersToHighScores();
    
    // Broadcast refresh to all connected clients
    io.emit('leaderboardRefresh', { timestamp: new Date().toISOString() });
    
    res.json({ success: true, message: 'Leaderboard refresh triggered' });
  } catch (error) {
    console.error('Error triggering leaderboard refresh:', error.message);
    res.status(500).json({ error: 'Failed to refresh leaderboard', message: error.message });
  }
});

// Trigger podium display from Unity
app.post('/api/unity/show-podium', async (req, res) => {
  const { rfid } = req.body;
  
  if (!rfid) {
    return res.status(400).json({ error: 'RFID required' });
  }

  try {
    // Broadcast to connected podium displays
    io.emit('showPodium', { rfid, timestamp: new Date().toISOString() });
    
    res.json({ success: true, message: 'Podium display triggered' });
  } catch (error) {
    console.error('Error triggering podium:', error.message);
    res.status(500).json({ error: 'Failed to trigger podium', message: error.message });
  }
});

// ==================== SOCKET.IO HANDLERS ====================

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Subscribe to leaderboard updates
  socket.on('subscribe-leaderboard', () => {
    socket.join('leaderboard');
    console.log(`📊 Client ${socket.id} subscribed to leaderboard updates`);
  });

  // Subscribe to podium updates
  socket.on('subscribe-podium', () => {
    socket.join('podium');
    console.log(`🏆 Client ${socket.id} subscribed to podium updates`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ==================== ERROR HANDLERS ====================

app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Error - SwingCity',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ==================== SERVER START ====================

async function startServer() {
  try {
    // Initialize Firebase REST service
    await firebaseService.initialize();
    
    // Test Firebase connection
    let firebaseStatus = { connected: false };
    try {
      const testData = await firebaseService.getLeaderboard(1);
      firebaseStatus = { connected: true };
      console.log('🔥 Firebase REST service connected successfully');
    } catch (error) {
      console.log('⚠️ Firebase REST connection failed, running in fallback mode');
    }
    
    // Start the server
    server.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('   🏌️ SwingCity - Team & Leaderboard Server');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`   🚀 Server running on http://localhost:${PORT}`);
      console.log(`   📅 Started at: ${new Date().toISOString()}`);
      console.log(`   🔥 Firebase: ${firebaseStatus.connected ? 'Connected' : 'Fallback Mode'}`);
      console.log('');
      console.log('   📍 Available Routes:');
      console.log(`      • Dashboard:   http://localhost:${PORT}/`);
      console.log(`      • Teams:       http://localhost:${PORT}/teams`);
      console.log(`      • Leaderboard: http://localhost:${PORT}/leaderboard`);
      console.log(`      • High Scores: http://localhost:${PORT}/highscores`);
      console.log(`      • Podium:      http://localhost:${PORT}/podium`);
      console.log(`      • Training:    http://localhost:${PORT}/training`);
      console.log('');
      console.log('   🎮 Unity Integration:');
      console.log('      • POST /api/unity/score');
      console.log('      • POST /api/unity/refresh-leaderboard');
      console.log('      • POST /api/unity/show-podium');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// ==================== GRACEFUL SHUTDOWN ====================

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };
