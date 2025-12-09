const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
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

// Create venue logos directory if it doesn't exist
const venueLogosDir = path.join(__dirname, 'public', 'images', 'venue-logos');
if (!fs.existsSync(venueLogosDir)) {
  fs.mkdirSync(venueLogosDir, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, venueLogosDir);
  },
  filename: function (req, file, cb) {
    // Use a consistent filename: venue-logo.{ext}
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `venue-logo${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, svg, webp)'));
    }
  }
});

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

// Settings page
app.get('/settings', (req, res) => {
  res.render('settings', {
    title: 'Settings - SwingCity'
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
app.post('/api/verify-pin', async (req, res) => {
  const { pin } = req.body;
  const sitePin = process.env.SITE_PIN || '5656';
  
  if (!pin) {
    return res.status(400).json({ success: false, message: 'PIN required' });
  }
  
  // Check default PIN first
  if (pin === sitePin) {
    // Default PIN has full access (management = true)
    return res.json({ 
      success: true, 
      message: 'Access granted',
      user: {
        name: 'Admin',
        pin: sitePin,
        management: true
      }
    });
  }
  
  // Check user pins
  try {
    const settings = await firebaseService.getSettings();
    const users = settings.users || {};
    
    // Find user by PIN
    const userEntry = Object.entries(users).find(([id, user]) => user.pin === pin);
    
    if (userEntry) {
      const [userId, user] = userEntry;
      return res.json({
        success: true,
        message: 'Access granted',
        user: {
          id: userId,
          name: user.name,
          pin: user.pin,
          management: user.management === true
        }
      });
    }
    
    // PIN not found
    res.status(401).json({ success: false, message: 'Invalid PIN' });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    res.status(500).json({ success: false, message: 'Error verifying PIN' });
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

// Remove all high scores with totalScore of 0
app.delete('/api/highscores/cleanup-zeros', async (req, res) => {
  try {
    const result = await firebaseService.removeZeroScoreHighScores();
    io.emit('highScoreUpdated', { source: 'cleanup', removed: result.removed });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error cleaning up zero-score high scores:', error.message);
    res.status(500).json({ 
      error: 'Failed to clean up high scores',
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
  const { rfid, teamName, players, teamEmail } = req.body;
  
  if (!rfid || !teamName || !players || !Array.isArray(players)) {
    return res.status(400).json({ 
      error: 'Invalid data', 
      message: 'RFID, team name, and players array are required' 
    });
  }

  try {
    const teamData = await firebaseService.createOrUpdateTeam(rfid, teamName, players, teamEmail || '');
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

// ==================== EMAIL SCORECARD ENDPOINT ====================

// Import nodemailer for email sending
const nodemailer = require('nodemailer');

// Create email transporter (configured lazily from Firebase settings)
let emailTransporter = null;
let emailSettings = null;

async function getEmailTransporter() {
  // Get settings from Firebase
  const settings = await firebaseService.getSettings();
  
  if (!settings.email || !settings.email.host || !settings.email.user || !settings.email.pass) {
    return null;
  }
  
  // Check if settings have changed
  const settingsKey = JSON.stringify({
    host: settings.email.host,
    port: settings.email.port,
    user: settings.email.user
  });
  
  if (!emailTransporter || emailSettings !== settingsKey) {
    emailTransporter = nodemailer.createTransport({
      host: settings.email.host,
      port: settings.email.port || 465,
      secure: settings.email.secure !== false,
      auth: {
        user: settings.email.user,
        pass: settings.email.pass
      }
    });
    emailSettings = settingsKey;
    console.log(`📧 Email transporter configured: ${settings.email.host}:${settings.email.port}`);
  }
  
  return { transporter: emailTransporter, settings: settings };
}

// Email scorecard to team
app.post('/api/email-scorecard', async (req, res) => {
  const { rfid, email } = req.body;
  
  if (!rfid || !email) {
    return res.status(400).json({ 
      error: 'Missing required fields', 
      message: 'RFID and email are required' 
    });
  }

  try {
    // Get team data
    const teamData = await firebaseService.getTeamByRFID(rfid);
    
    if (!teamData) {
      return res.status(404).json({ error: 'Team not found' });
    }

    console.log(`📧 Scorecard email requested for ${email} (Team: ${teamData.teamName})`);
    
    // Get email transporter with settings from Firebase
    const emailConfig = await getEmailTransporter();
    
    if (emailConfig && emailConfig.transporter) {
      const { transporter, settings } = emailConfig;
      const venueName = settings.venue?.name || 'SwingCity';
      
      // Get venue logo path from settings
      const venueLogo = settings.venue?.logo || null;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const logoUrl = venueLogo ? `${baseUrl}${venueLogo}` : null;
      
      // Generate scorecard HTML for email
      const scorecardHtml = generateScorecardEmailHtml(teamData, venueName, logoUrl, baseUrl);
      
      // Build from address
      const fromName = settings.email.fromName || venueName;
      const fromAddress = `${fromName} <${settings.email.user}>`;
      
      // Send the actual email
      const mailOptions = {
        from: fromAddress,
        to: email,
        subject: `🏌️ Your ${venueName} Scorecard - ${teamData.teamName}`,
        html: scorecardHtml
      };
      
      await transporter.sendMail(mailOptions);
      console.log(`✅ Scorecard email sent to ${email}`);
      
      res.json({ 
        success: true, 
        message: 'Scorecard email sent successfully',
        team: teamData.teamName,
        email: email
      });
    } else {
      console.log('⚠️ Email not configured - go to Settings to configure');
      res.status(503).json({ 
        error: 'Email not configured', 
        message: 'Email service is not configured. Go to Settings to set it up.' 
      });
    }
  } catch (error) {
    console.error('Error sending scorecard email:', error);
    res.status(500).json({ 
      error: 'Failed to send email', 
      message: error.message 
    });
  }
});

// Helper function to generate beautiful scorecard email HTML
function generateScorecardEmailHtml(teamData, venueName = 'SwingCity', logoUrl = null, baseUrl = '') {
  const holes = ['Plinko', 'SpinningTop', 'Haphazard', 'Roundhouse', 'HillHop', 'SkiJump', 'Mastermind', 'Igloo', 'Octagon', 'LoopDeLoop', 'UpAndOver', 'Lopside'];
  
  // Calculate player totals and find winner
  const playersWithTotals = teamData.players.map(player => {
    let total = 0;
    holes.forEach(hole => {
      if (player.scores && player.scores[hole]) {
        total += player.scores[hole].total || 0;
      }
    });
    return { ...player, total };
  }).sort((a, b) => b.total - a.total);
  
  const winner = playersWithTotals[0];
  const teamTotal = playersWithTotals.reduce((sum, p) => sum + p.total, 0);
  
  // Venue logo HTML - show logo if available
  const venueLogoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${venueName}" style="max-width: 180px; max-height: 70px; height: auto; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;">`
    : '';
  
  // SwingCity logo URL
  const swingCityLogoUrl = baseUrl ? `${baseUrl}/images/swingcity-main-logo.png` : '/images/swingcity-main-logo.png';
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Space Grotesk', 'Segoe UI', Arial, sans-serif; background-color: #06080d;">
  <div style="max-width: 600px; margin: 0 auto; background: #0d1117; padding: 0;">
    
    <!-- Header with Venue Logo -->
    <div style="background: #161b22; padding: 35px 20px 25px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
      ${venueLogoHtml}
      <p style="margin: 12px 0 0; color: #8b949e; font-size: 12px; letter-spacing: 0.5px;">Interactive Arcade Golf</p>
    </div>
    
    <!-- Winner Highlight -->
    <div style="margin: 30px 20px 25px; padding: 25px 20px; background: rgba(251, 191, 36, 0.08); border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.2); text-align: center;">
      <p style="color: #fbbf24; font-size: 10px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">🏆 Winner</p>
      <p style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 8px;">${winner.name}</p>
      <p style="color: #fbbf24; font-size: 20px; font-weight: 600; margin: 0;">${winner.total} pts</p>
    </div>
    
    <!-- Player Scores -->
    <div style="padding: 0 20px 25px;">
      <table style="width: 100%; border-collapse: collapse; background: #161b22; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.06);">
        <thead>
          <tr>
            <th style="padding: 14px 16px; background: #0d1117; color: #8b949e; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Player</th>
            <th style="padding: 14px 16px; background: #0d1117; color: #00ff88; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Score</th>
          </tr>
        </thead>
        <tbody>`;
  
  playersWithTotals.forEach((player, index) => {
    const isWinner = index === 0;
    const bgColor = isWinner ? 'rgba(251, 191, 36, 0.05)' : 'transparent';
    const nameColor = isWinner ? '#fbbf24' : '#ffffff';
    const borderStyle = index < playersWithTotals.length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.06);' : '';
    
    html += `
          <tr style="${borderStyle}">
            <td style="padding: 14px 16px; background: ${bgColor}; color: ${nameColor}; font-weight: 500; font-size: 14px;">${player.name}</td>
            <td style="padding: 14px 16px; background: ${bgColor}; color: #00ff88; text-align: right; font-weight: 600; font-size: 16px;">${player.total}</td>
          </tr>`;
  });
  
  html += `
        </tbody>
      </table>
    </div>
    
    <!-- Hole Breakdown -->
    <div style="padding: 0 20px 30px;">
      <p style="color: #8b949e; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px; font-weight: 600;">Hole Breakdown</p>
      <div style="background: #161b22; border-radius: 8px; padding: 16px; overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.06);">
        <table style="width: 100%; border-collapse: collapse; min-width: 500px;">
          <thead>
            <tr>
              <th style="padding: 10px 8px; color: #8b949e; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Player</th>`;
  
  holes.forEach((hole, i) => {
    const colors = ['#ec4899', '#00d4ff', '#fbbf24'];
    const color = colors[i % 3];
    html += `<th style="padding: 10px 4px; color: ${color}; text-align: center; font-size: 9px; font-weight: 600;">${hole.slice(0, 4)}</th>`;
  });
  
  html += `<th style="padding: 10px 8px; color: #00ff88; text-align: center; font-size: 10px; font-weight: 600;">TOT</th>
            </tr>
          </thead>
          <tbody>`;
  
  playersWithTotals.forEach((player, playerIndex) => {
    const isWinnerRow = playerIndex === 0;
    const rowBg = isWinnerRow ? 'rgba(251, 191, 36, 0.03)' : 'transparent';
    html += `<tr style="background: ${rowBg};">
              <td style="padding: 10px 8px; color: ${isWinnerRow ? '#fbbf24' : '#ffffff'}; font-size: 11px; white-space: nowrap; font-weight: ${isWinnerRow ? '600' : '500'}; border-bottom: 1px solid rgba(255,255,255,0.06);">${player.name.split(' ')[0]}</td>`;
    
    holes.forEach(hole => {
      const score = player.scores && player.scores[hole] ? player.scores[hole].total : 0;
      const scoreColor = score > 0 ? '#00ff88' : score < 0 ? '#f87171' : '#6b7280';
      html += `<td style="padding: 10px 4px; color: ${scoreColor}; text-align: center; font-size: 11px; font-weight: ${score !== 0 ? '500' : '400'}; border-bottom: 1px solid rgba(255,255,255,0.06);">${score || '-'}</td>`;
    });
    
    html += `<td style="padding: 10px 8px; color: #00ff88; text-align: center; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.06);">${player.total}</td>
            </tr>`;
  });
  
  html += `
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Discount Offer -->
    <div style="background: rgba(168, 85, 247, 0.08); margin: 0 20px 25px; padding: 25px 20px; border-radius: 12px; text-align: center; border: 1px solid rgba(168, 85, 247, 0.2);">
      <p style="color: #a855f7; font-size: 10px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Special Offer</p>
      <p style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0 0 12px;">10% OFF Your Next Visit!</p>
      <div style="background: #0d1117; display: inline-block; padding: 12px 28px; border-radius: 8px; margin-top: 8px; border: 1px solid rgba(0, 255, 136, 0.2);">
        <span style="color: #00ff88; font-size: 24px; font-weight: 600; letter-spacing: 4px;">SWING10</span>
      </div>
      <p style="color: #8b949e; font-size: 11px; margin: 15px 0 0;">Show this code at reception on your next visit</p>
    </div>
    
    <!-- Footer with SwingCity Logo -->
    <div style="padding: 30px 20px 25px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); background: #161b22;">
      <!-- SwingCity Logo -->
      <div style="margin-bottom: 18px;">
        <img src="${swingCityLogoUrl}" alt="SwingCity" style="max-width: 180px; height: auto; opacity: 0.85;">
      </div>
      
      <p style="color: #8b949e; font-size: 12px; margin: 0 0 6px;">Thank you for playing at ${venueName}!</p>
      <p style="color: #6b7280; font-size: 10px; margin: 0;">© ${new Date().getFullYear()} ${venueName} • Interactive Arcade Golf</p>
    </div>
    
  </div>
</body>
</html>`;
  
  return html;
}

// ==================== SETTINGS API ENDPOINTS ====================

// Get all settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await firebaseService.getSettings();
    // Don't send password back to client
    if (settings.email && settings.email.pass) {
      settings.email.pass = '********';
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.json({ venue: {}, email: {} });
  }
});

// Test route to verify server is running updated code
app.get('/api/test-routes', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Routes are working',
    timestamp: new Date().toISOString()
  });
});

// Save venue settings
app.post('/api/settings/venue', async (req, res) => {
  const { name, location } = req.body;
  
  try {
    // Get existing settings to preserve logo if not provided
    const existing = await firebaseService.getSettings();
    const venueSettings = {
      name,
      location,
      logo: existing.venue?.logo || null
    };
    
    await firebaseService.saveSettings('venue', venueSettings);
    console.log(`✅ Venue settings saved: ${name}, ${location}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving venue settings:', error);
    res.status(500).json({ error: 'Failed to save', message: error.message });
  }
});

// Upload venue logo
app.post('/api/settings/venue/logo', upload.single('logo'), async (req, res) => {
  console.log('📤 Logo upload endpoint hit');
  try {
    if (!req.file) {
      console.log('⚠️ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get existing settings
    const existing = await firebaseService.getSettings();
    const logoPath = `/images/venue-logos/${req.file.filename}`;
    
    // If there's an old logo, delete it
    if (existing.venue?.logo) {
      const oldLogoPath = path.join(__dirname, 'public', existing.venue.logo);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }
    
    // Save logo path to settings
    const venueSettings = {
      ...existing.venue,
      logo: logoPath
    };
    
    await firebaseService.saveSettings('venue', venueSettings);
    console.log(`✅ Venue logo uploaded: ${logoPath}`);
    
    res.json({ 
      success: true, 
      logoPath: logoPath,
      message: 'Logo uploaded successfully' 
    });
  } catch (error) {
    console.error('Error uploading logo:', error);
    res.status(500).json({ error: 'Failed to upload logo', message: error.message });
  }
});

// Delete venue logo
app.delete('/api/settings/venue/logo', async (req, res) => {
  try {
    const existing = await firebaseService.getSettings();
    
    if (existing.venue?.logo) {
      const logoPath = path.join(__dirname, 'public', existing.venue.logo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
      
      // Remove logo from settings
      const venueSettings = {
        ...existing.venue,
        logo: null
      };
      
      await firebaseService.saveSettings('venue', venueSettings);
      console.log('✅ Venue logo deleted');
    }
    
    res.json({ success: true, message: 'Logo deleted successfully' });
  } catch (error) {
    console.error('Error deleting logo:', error);
    res.status(500).json({ error: 'Failed to delete logo', message: error.message });
  }
});

// Preview email scorecard
app.post('/api/email-scorecard/preview', async (req, res) => {
  console.log('👁️ Email preview endpoint hit');
  try {
    const { rfid } = req.body;
    
    if (!rfid) {
      return res.status(400).json({ 
        success: false,
        error: 'RFID required',
        message: 'RFID is required to generate preview' 
      });
    }
    
    // Get team data
    let teamData;
    try {
      teamData = await firebaseService.getTeamByRFID(rfid);
    } catch (teamError) {
      console.error('Error fetching team:', teamError);
      return res.status(404).json({ 
        success: false,
        error: 'Team not found',
        message: `No team found with RFID: ${rfid}` 
      });
    }
    
    if (!teamData || !teamData.players || teamData.players.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Team not found',
        message: `Team with RFID ${rfid} has no players` 
      });
    }
    
    // Get settings
    const settings = await firebaseService.getSettings();
    const venueName = settings.venue?.name || 'SwingCity';
    const logoPath = settings.venue?.logo || null;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const logoUrl = logoPath ? `${baseUrl}${logoPath}` : null;
    
    // Generate HTML
    const html = generateScorecardEmailHtml(teamData, venueName, logoUrl, baseUrl);
    
    res.json({ success: true, html: html });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate preview', 
      message: error.message || 'An unexpected error occurred' 
    });
  }
});

// Save email settings
app.post('/api/settings/email', async (req, res) => {
  const { host, port, secure, user, pass, fromName } = req.body;
  
  try {
    // Get existing settings to preserve password if not provided
    const existing = await firebaseService.getSettings();
    const emailSettings = {
      host,
      port,
      secure,
      user,
      fromName,
      pass: pass || (existing.email ? existing.email.pass : '')
    };
    
    await firebaseService.saveSettings('email', emailSettings);
    
    // Reset the email transporter so it picks up new settings
    emailTransporter = null;
    
    console.log(`✅ Email settings saved for: ${user}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving email settings:', error);
    res.status(500).json({ error: 'Failed to save', message: error.message });
  }
});

// ==================== USER MANAGEMENT API ====================

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await firebaseService.getUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', message: error.message });
  }
});

// Add or update a user
app.post('/api/users', async (req, res) => {
  const { userId, name, pin, management } = req.body;
  
  if (!name || !pin) {
    return res.status(400).json({ error: 'Name and PIN are required' });
  }
  
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }
  
  try {
    // Generate userId if not provided
    const finalUserId = userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await firebaseService.saveUser(finalUserId, {
      name,
      pin,
      management: management === true
    });
    
    res.json({ success: true, userId: finalUserId });
  } catch (error) {
    console.error('Error saving user:', error);
    res.status(500).json({ error: 'Failed to save user', message: error.message });
  }
});

// Delete a user
app.delete('/api/users/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    await firebaseService.deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user', message: error.message });
  }
});

// Test email
app.post('/api/settings/email/test', async (req, res) => {
  const { to } = req.body;
  
  if (!to) {
    return res.status(400).json({ error: 'Email address required' });
  }
  
  try {
    // Get settings from Firebase
    const settings = await firebaseService.getSettings();
    
    if (!settings.email || !settings.email.host || !settings.email.user) {
      return res.status(400).json({ 
        error: 'Email not configured', 
        message: 'Please save email settings first' 
      });
    }
    
    // Create a test transporter
    const testTransporter = nodemailer.createTransport({
      host: settings.email.host,
      port: settings.email.port || 465,
      secure: settings.email.secure !== false,
      auth: {
        user: settings.email.user,
        pass: settings.email.pass
      }
    });
    
    const venueName = settings.venue?.name || 'SwingCity';
    
    await testTransporter.sendMail({
      from: settings.email.fromName ? `${settings.email.fromName} <${settings.email.user}>` : settings.email.user,
      to: to,
      subject: `✅ Test Email from ${venueName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #12121a; color: white; border-radius: 16px;">
          <h1 style="color: #00ff88; margin-bottom: 20px;">🎉 Email Working!</h1>
          <p style="color: #9ca3af; line-height: 1.6;">
            Great news! Your email settings are configured correctly. 
            Scorecards will be sent from this address.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              ${venueName} • SwingCity Platform
            </p>
          </div>
        </div>
      `
    });
    
    console.log(`✅ Test email sent to ${to}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      error: 'Failed to send test email', 
      message: error.message 
    });
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

  // Show team scorecard on leaderboard (from Team Manager)
  socket.on('showTeamScorecard', (data) => {
    console.log(`📋 Show scorecard request for RFID: ${data.rfid}`);
    // Broadcast to all clients (especially the leaderboard)
    io.emit('displayTeamScorecard', { rfid: data.rfid });
  });

  // Hide team scorecard on leaderboard
  socket.on('hideTeamScorecard', () => {
    console.log(`📋 Hide scorecard request`);
    io.emit('hideTeamScorecard');
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// ==================== ERROR HANDLERS ====================

app.use((req, res) => {
  // Return JSON for API routes, HTML for page routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `API endpoint ${req.method} ${req.path} not found`
    });
  }
  
  res.status(404).render('404', {
    title: '404 - Page Not Found'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // If it's an API route, return JSON instead of HTML
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
  }
  
  res.status(500).render('error', {
    title: 'Error - SwingCity',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// ==================== SERVER START ====================

// ==================== AUTOMATIC HIGH SCORE SYNC ====================
// This runs continuously to sync players from rfidCards to highScores
let highScoreSyncInterval = null;

async function syncHighScores() {
  try {
    await firebaseService.syncAllPlayersToHighScores();
    io.emit('highScoreUpdated', { source: 'autoSync', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('⚠️ Auto high score sync failed:', error.message);
  }
}

function startHighScoreSync() {
  // Run sync immediately on startup
  syncHighScores();
  
  // Then run every 30 seconds to keep highScores in sync with rfidCards
  highScoreSyncInterval = setInterval(syncHighScores, 30000);
  console.log('🔄 Automatic high score sync started (runs every 30 seconds)');
}

function stopHighScoreSync() {
  if (highScoreSyncInterval) {
    clearInterval(highScoreSyncInterval);
    highScoreSyncInterval = null;
  }
}

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
    
    // Start automatic high score syncing
    if (firebaseStatus.connected) {
      startHighScoreSync();
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
      console.log('');
      console.log('   ⚙️  Settings & Email:');
      console.log('      • POST /api/settings/venue/logo');
      console.log('      • POST /api/email-scorecard/preview');
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
  
  // Stop high score sync
  stopHighScoreSync();
  
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
