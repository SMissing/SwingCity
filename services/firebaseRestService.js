// Firebase REST API Service for SwingCity V2
// Using REST API to avoid authentication issues
const fetch = require('node-fetch');

class FirebaseRestService {
  constructor() {
    this.baseUrl = process.env.FIREBASE_DATABASE_URL || 'https://swingcity-6cad7-default-rtdb.europe-west1.firebasedatabase.app';
    this.mockMode = false;
  }

  // Initialize the service
  async initialize() {
  // Test Firebase REST Service connection
    
    try {
      // Test the connection
      const response = await fetch(`${this.baseUrl}/.json`);
      if (response.ok) {
  console.log('✅ Firebase REST Service initialized successfully'); // Only log this once for test
  this.mockMode = false;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Firebase REST Service initialization failed:', error.message);
  // Running in mock mode (no database connection)
      this.mockMode = true;
    }
  }

  // ==================== TEAM OPERATIONS ====================

  // Get team data by RFID
  async getTeamByRFID(rfid) {
    if (this.mockMode) {
      return this.getMockTeamData(rfid);
    }

    try {
      // Get the RFID card data directly
      const rfidResponse = await fetch(`${this.baseUrl}/rfidCards/${rfid}.json`);
      
      if (!rfidResponse.ok) {
        throw new Error(`RFID ${rfid} not found in database`);
      }

      const cardData = await rfidResponse.json();
      
      if (!cardData) {
        throw new Error(`RFID ${rfid} not found in database`);
      }

  // Removed verbose RFID card debug log

      // Build team structure from the card data
      const players = [];
      if (cardData.players && typeof cardData.players === 'object') {
        for (const [email, playerData] of Object.entries(cardData.players)) {
          // Convert the player data to our expected format
          const scores = {};
          
          if (playerData.scorePerHole && typeof playerData.scorePerHole === 'object') {
            for (const [holeName, holeScores] of Object.entries(playerData.scorePerHole)) {
              if (holeScores && typeof holeScores === 'object') {
                // Convert the scores format
                const throws = [];
                let total = 0;
                
                // Handle different score formats
                if (Array.isArray(holeScores)) {
                  throws.push(...holeScores);
                  total = holeScores.reduce((sum, score) => sum + score, 0);
                } else if (typeof holeScores === 'object') {
                  // Handle object format scores
                  if (holeScores.throws && Array.isArray(holeScores.throws)) {
                    throws.push(...holeScores.throws);
                  }
                  // Use explicit check for undefined/null instead of truthy check to preserve 0 scores
                  total = (holeScores.total !== undefined && holeScores.total !== null) 
                    ? holeScores.total 
                    : 0;
                } else if (typeof holeScores === 'number') {
                  throws.push(holeScores);
                  total = holeScores;
                }
                
                scores[holeName] = {
                  throws: throws,
                  total: total
                };
              }
            }
          }

          players.push({
            id: email,
            name: playerData.displayName || email.split('@')[0],
            scores: scores,
            totalScoreForThisVisit: playerData.totalScoreForThisVisit || 0
          });
        }
      }

      // Ensure all players have all holes initialized with zero scores if missing
      const allHoles = ['Plinko', 'SpinningTop', 'Haphazard', 'Roundhouse', 'HillHop', 'SkiJump', 'Mastermind', 'Igloo', 'Octagon', 'LoopDeLoop', 'UpAndOver', 'Lopside', 'Lopsided'];
      players.forEach(player => {
        allHoles.forEach(hole => {
          if (!player.scores[hole]) {
            player.scores[hole] = {
              throws: [],
              total: 0
            };
          }
        });
      });

      // Use team name from card data or generate one as fallback
      const teamName = cardData.teamName || `Team ${rfid.slice(-4).toUpperCase()}`;

      // Get the actual holesCompleted object from the database (not calculated)
      const holesCompleted = cardData.holesCompleted || {};

      return {
        id: rfid,
        rfid: rfid,
        teamName: teamName,
        teamEmail: cardData.teamEmail || '',
        players: players,
        totalScore: this.calculateTeamTotal(players),
        holesCompleted: holesCompleted,
        holesCompletedCount: this.calculateHolesCompleted(players),
        lastActivity: cardData.lastActivity || new Date().toISOString(),
        created: cardData.created || null
      };

    } catch (error) {
      console.error(`❌ Error getting team ${rfid}:`, error.message);
      throw error;
    }
  }

  // Create or update team
  async saveTeam(teamData) {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would save team:', teamData.rfid);
      return teamData;
    }

    try {
      // Update RFID card record
      const rfidCardData = {
        teamName: teamData.teamName,
        players: teamData.players.map(p => p.id),
        lastActivity: new Date().toISOString()
      };

      const rfidResponse = await fetch(`${this.baseUrl}/rfidCards/${teamData.rfid}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rfidCardData)
      });

      if (!rfidResponse.ok) {
        throw new Error(`Failed to save RFID card: ${rfidResponse.statusText}`);
      }

      // Update player records
      for (const player of teamData.players) {
        const playerResponse = await fetch(`${this.baseUrl}/players/${player.id}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: player.name,
            lastActivity: new Date().toISOString()
          })
        });

        if (!playerResponse.ok) {
          console.warn(`⚠️ Failed to update player ${player.id}`);
        }
      }

      console.log(`✅ Team ${teamData.rfid} saved to Firebase`);
      return teamData;
    } catch (error) {
      console.error(`❌ Error saving team:`, error.message);
      throw error;
    }
  }

  // Update existing team data
  async updateTeam(rfid, updateData) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would update team:', { rfid, updateData });
      return { success: true };
    }

    try {
      // First get the current team data
      const currentTeamResponse = await fetch(`${this.baseUrl}/rfidCards/${rfid}.json`);
      
      if (!currentTeamResponse.ok) {
        throw new Error(`Team with RFID ${rfid} not found`);
      }

      const currentTeam = await currentTeamResponse.json();
      
      if (!currentTeam) {
        throw new Error(`Team with RFID ${rfid} not found`);
      }

      // Update basic team info
      if (updateData.teamName) {
        currentTeam.teamName = updateData.teamName;
      }
      
      currentTeam.lastUpdated = updateData.lastUpdated || new Date().toISOString();

      // Update players and their scores
      if (updateData.players) {
        // Clear existing players data
        currentTeam.players = {};
        
        updateData.players.forEach(player => {
          const email = player.id; // Use the existing player ID
          currentTeam.players[email] = {
            displayName: player.name,
            scorePerHole: {},
            totalScoreForThisVisit: 0
          };

          // Set the scores for each hole
          if (player.scores) {
            Object.keys(player.scores).forEach(hole => {
              currentTeam.players[email].scorePerHole[hole] = {
                throws: player.scores[hole].throws || [],
                total: player.scores[hole].total || 0
              };
              
              // Add to total score
              currentTeam.players[email].totalScoreForThisVisit += player.scores[hole].total || 0;
            });
          }

          // Initialize empty holes that weren't provided
          const holes = ['Plinko', 'SpinningTop', 'Haphazard', 'Roundhouse', 'HillHop', 'SkiJump', 'Mastermind', 'Igloo', 'Octagon', 'LoopDeLoop', 'UpAndOver', 'Lopside', 'Lopsided'];
          holes.forEach(hole => {
            if (!currentTeam.players[email].scorePerHole[hole]) {
              currentTeam.players[email].scorePerHole[hole] = {
                throws: [],
                total: 0
              };
            }
          });
        });
      }

      // Update holes completed - use provided values if available, otherwise calculate from scores
      if (updateData.holesCompleted && Object.keys(updateData.holesCompleted).length > 0) {
        // Use the explicitly provided holesCompleted values (manual override by staff)
        currentTeam.holesCompleted = { ...currentTeam.holesCompleted, ...updateData.holesCompleted };
      } else if (currentTeam.holesCompleted) {
        // Auto-calculate based on scores if not explicitly provided
        Object.keys(currentTeam.holesCompleted).forEach(hole => {
          currentTeam.holesCompleted[hole] = Object.values(currentTeam.players).some(player => 
            player.scorePerHole[hole] && (player.scorePerHole[hole].total !== 0 || player.scorePerHole[hole].throws.length > 0)
          );
        });
      }

      // Save the updated team data
      const response = await fetch(`${this.baseUrl}/rfidCards/${rfid}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentTeam)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Team updated successfully:', rfid);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating team:', error);
      throw error;
    }
  }

  // ==================== SCORE OPERATIONS ====================

  // Save player score for a hole
  async savePlayerScore(playerId, holeId, scoreData) {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would save score:', { playerId, holeId, scoreData });
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/players/${playerId}/scores/${holeId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          throws: scoreData.throws,
          total: scoreData.total,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Score saved: ${playerId} - ${holeId} - ${scoreData.total} points`);
    } catch (error) {
      console.error(`❌ Error saving score:`, error.message);
      throw error;
    }
  }

  // Get all scores for a player
  async getPlayerScores(playerId) {
    if (this.mockMode) {
      return this.generateMockScores();
    }

    try {
      const response = await fetch(`${this.baseUrl}/players/${playerId}/scores.json`);
      if (response.ok) {
        const scores = await response.json();
        return scores || {};
      }
      return {};
    } catch (error) {
      console.error(`❌ Error getting player scores:`, error.message);
      return {};
    }
  }

  // ==================== GAME SESSION OPERATIONS ====================

  // Save active game session (lightweight snapshot for monitoring)
  async saveGameSession(sessionData) {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would save game session:', sessionData && sessionData.rfid);
      return { success: true };
    }

    try {
      if (!sessionData || !sessionData.rfid) {
        throw new Error('Invalid session data: rfid is required');
      }

      const toIso = (d) => (d instanceof Date ? d.toISOString() : d);

      const payload = {
        holeId: sessionData.holeId,
        teamName: sessionData.teamName,
        currentPlayerIndex: sessionData.currentPlayerIndex,
        currentThrow: sessionData.currentThrow,
        status: sessionData.status,
        startTime: toIso(sessionData.startTime),
        lastActivity: toIso(sessionData.lastActivity)
      };

      const response = await fetch(`${this.baseUrl}/activeSessions/${sessionData.rfid}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Game session saved: ${sessionData.rfid}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving game session:', error.message);
      throw error;
    }
  }

  // Remove completed game session
  async removeGameSession(rfid) {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would remove game session:', rfid);
      return { success: true };
    }

    try {
      if (!rfid) {
        throw new Error('rfid is required');
      }

      const response = await fetch(`${this.baseUrl}/activeSessions/${rfid}.json`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Game session removed: ${rfid}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error removing game session:', error.message);
      throw error;
    }
  }

  // ==================== LEADERBOARD OPERATIONS ====================

  // Get top teams for leaderboard
  async getLeaderboard(limit = 10) {
    if (this.mockMode) {
      return this.getMockLeaderboard(limit);
    }

    try {
      // Get all RFID cards
      const rfidResponse = await fetch(`${this.baseUrl}/rfidCards.json`);
      const rfidCards = await rfidResponse.json();

      // Get all players
      const playersResponse = await fetch(`${this.baseUrl}/players.json`);
      const allPlayers = await playersResponse.json();

      const leaderboard = [];

      if (rfidCards && allPlayers) {
        for (const [rfid, cardData] of Object.entries(rfidCards)) {
          const teamData = await this.getTeamByRFID(rfid);
          leaderboard.push(teamData);
        }
      }

      // Sort by total score (descending)
      leaderboard.sort((a, b) => b.totalScore - a.totalScore);
      
      return leaderboard.slice(0, limit);

    } catch (error) {
      console.error('❌ Error getting leaderboard:', error.message);
      return this.getMockLeaderboard(limit);
    }
  }

  // ==================== TEAM MANAGEMENT OPERATIONS ====================

  // Create or update a team
  async createOrUpdateTeam(rfid, teamName, players, teamEmail = '') {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would create/update team:', { rfid, teamName, players, teamEmail });
      return { id: rfid, rfid, teamName, players, teamEmail, created: new Date().toISOString() };
    }

    try {
      // Prepare the team data structure
      const teamData = {
        rfid: rfid,
        teamName: teamName,
        teamEmail: teamEmail || '',
        players: {},
        holesCompleted: {},
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // Initialize holes completed tracking
      const holes = ['Plinko', 'SpinningTop', 'Haphazard', 'Roundhouse', 'HillHop', 'SkiJump', 'Mastermind', 'Igloo', 'Octagon', 'LoopDeLoop', 'UpAndOver', 'Lopside'];
      holes.forEach(hole => {
        teamData.holesCompleted[hole] = false;
      });

      // Add players to the team data
      players.forEach(player => {
        const email = player.email.replace(/\./g, '_').replace(/@/g, '_');
        teamData.players[email] = {
          displayName: player.name,
          scorePerHole: {},
          totalScoreForThisVisit: 0
        };

        // Initialize score tracking for each hole
        holes.forEach(hole => {
          teamData.players[email].scorePerHole[hole] = {
            throws: [],
            total: 0
          };
        });
      });

      // Store the team data
      const response = await fetch(`${this.baseUrl}/rfidCards/${rfid}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Team created/updated successfully:', rfid);
      return { id: rfid, rfid, teamName, players, created: teamData.created };
    } catch (error) {
      console.error('❌ Error creating/updating team:', error);
      throw error;
    }
  }

  // Get all teams
  async getAllTeams() {
    if (this.mockMode) {
      return this.getMockLeaderboard(5);
    }

    try {
      const response = await fetch(`${this.baseUrl}/rfidCards.json`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const teams = [];

      if (data && typeof data === 'object') {
        for (const [rfid, teamData] of Object.entries(data)) {
          const players = [];
          
          if (teamData.players && typeof teamData.players === 'object') {
            for (const [email, playerData] of Object.entries(teamData.players)) {
              players.push({
                id: email,
                name: playerData.displayName || email.split('_')[0],
                email: email.replace(/_/g, '@').replace(/_/g, '.')
              });
            }
          }

          teams.push({
            id: rfid,
            rfid: rfid,
            teamName: teamData.teamName || `Team ${rfid}`,
            players: players,
            created: teamData.created || null,
            lastUpdated: teamData.lastUpdated || null
          });
        }
      }

      return teams;
    } catch (error) {
      console.error('❌ Error fetching all teams:', error);
      throw error;
    }
  }

  // Delete a team
  async deleteTeam(rfid) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would delete team:', rfid);
      return { success: true };
    }

    try {
      const response = await fetch(`${this.baseUrl}/rfidCards/${rfid}.json`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('✅ Team deleted successfully:', rfid);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      throw error;
    }
  }

  // ==================== HIGH SCORE OPERATIONS ====================

  // Save or update a high score for a player (using email/ID as unique key)
  async saveHighScore(playerId, playerName, totalScore, rfid = null) {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would save high score:', { playerId, playerName, totalScore });
      return { success: true };
    }

    try {
      // Sanitize the player ID for use as a Firebase key (replace . and @ with _)
      const sanitizedId = playerId.replace(/\./g, '_').replace(/@/g, '_');
      
      // Check if this player already has a high score entry
      const existingResponse = await fetch(`${this.baseUrl}/highScores/${sanitizedId}.json`);
      const existingData = existingResponse.ok ? await existingResponse.json() : null;
      
      // If player exists and score is the same, no update needed
      if (existingData && existingData.totalScore === totalScore) {
        return { success: true, updated: false, message: 'Score unchanged' };
      }
      
      const highScoreData = {
        playerId: playerId,
        playerName: playerName,
        totalScore: totalScore,
        lastUpdated: new Date().toISOString(),
        rfid: rfid
      };

      // Use PUT with sanitized ID as key for deduplication
      const response = await fetch(`${this.baseUrl}/highScores/${sanitizedId}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(highScoreData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const action = existingData ? 'updated' : 'saved';
      console.log(`🏆 High score ${action}: ${playerName} - ${totalScore} points`);
      return { success: true, updated: !!existingData };
    } catch (error) {
      console.error('❌ Error saving high score:', error.message);
      throw error;
    }
  }

  // Get top high scores
  async getTopHighScores(limit = 10) {
    if (this.mockMode) {
      return this.getMockHighScores(limit);
    }

    try {
      const response = await fetch(`${this.baseUrl}/highScores.json`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const highScores = [];

      if (data && typeof data === 'object') {
        for (const [id, scoreData] of Object.entries(data)) {
          highScores.push({
            id: id,
            playerId: scoreData.playerId,
            playerName: scoreData.playerName,
            totalScore: scoreData.totalScore,
            lastUpdated: scoreData.lastUpdated,
            rfid: scoreData.rfid
          });
        }
      }

      // Sort by total score (highest first) and take top entries
      highScores.sort((a, b) => b.totalScore - a.totalScore);
      return highScores.slice(0, limit);
    } catch (error) {
      console.error('❌ Error getting high scores:', error.message);
      return [];
    }
  }

  // Sync all players from all teams to high scores (auto-populate)
  async syncAllPlayersToHighScores() {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would sync all players to high scores');
      return { success: true, synced: 0 };
    }

    try {
      console.log('🔄 Syncing all players to high scores...');
      
      // Get all teams/RFID cards
      const response = await fetch(`${this.baseUrl}/rfidCards.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rfidCards = await response.json();
      
      if (!rfidCards || typeof rfidCards !== 'object') {
        console.log('No teams found to sync');
        return { success: true, synced: 0 };
      }

      let syncedCount = 0;
      let updatedCount = 0;

      // Iterate through all teams
      for (const [rfid, cardData] of Object.entries(rfidCards)) {
        if (!cardData.players || typeof cardData.players !== 'object') continue;

        // Iterate through all players in this team
        for (const [playerId, playerData] of Object.entries(cardData.players)) {
          // Calculate total score for this player
          let totalScore = 0;
          
          if (playerData.scorePerHole && typeof playerData.scorePerHole === 'object') {
            for (const [holeName, holeScores] of Object.entries(playerData.scorePerHole)) {
              if (holeScores && typeof holeScores === 'object') {
                totalScore += holeScores.total || 0;
              } else if (typeof holeScores === 'number') {
                totalScore += holeScores;
              }
            }
          }
          
          // Also check totalScoreForThisVisit if available
          if (playerData.totalScoreForThisVisit && totalScore === 0) {
            totalScore = playerData.totalScoreForThisVisit;
          }

          const playerName = playerData.displayName || playerId.split('@')[0].split('_')[0];
          
          // Save/update the high score
          const result = await this.saveHighScore(playerId, playerName, totalScore, rfid);
          
          if (result.success) {
            if (result.updated) {
              updatedCount++;
            } else {
              syncedCount++;
            }
          }
        }
      }

      console.log(`✅ High scores sync complete: ${syncedCount} new, ${updatedCount} updated`);
      return { success: true, synced: syncedCount, updated: updatedCount };
    } catch (error) {
      console.error('❌ Error syncing high scores:', error.message);
      throw error;
    }
  }

  // Update a single player's high score (called after score changes)
  async updatePlayerHighScore(player, rfid = null) {
    const totalScore = this.calculatePlayerTotal(player);
    return await this.saveHighScore(player.id, player.name, totalScore, rfid);
  }

  // Remove all high scores with totalScore of 0
  async removeZeroScoreHighScores() {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would remove zero-score high scores');
      return { success: true, removed: 0 };
    }

    try {
      console.log('🧹 Cleaning up zero-score high scores...');
      
      // Get all high scores
      const response = await fetch(`${this.baseUrl}/highScores.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const highScores = await response.json();
      
      if (!highScores || typeof highScores !== 'object') {
        console.log('No high scores found to clean up');
        return { success: true, removed: 0 };
      }

      let removedCount = 0;
      const deletions = [];

      // Find all entries with totalScore of 0
      for (const [playerId, scoreData] of Object.entries(highScores)) {
        if (scoreData && scoreData.totalScore === 0) {
          deletions.push(playerId);
        }
      }

      // Delete all zero-score entries
      for (const playerId of deletions) {
        const deleteResponse = await fetch(`${this.baseUrl}/highScores/${playerId}.json`, {
          method: 'DELETE'
        });

        if (deleteResponse.ok) {
          removedCount++;
        } else {
          console.warn(`⚠️ Failed to delete high score: ${playerId}`);
        }
      }

      console.log(`✅ Cleanup complete: Removed ${removedCount} zero-score entries`);
      return { success: true, removed: removedCount };
    } catch (error) {
      console.error('❌ Error removing zero-score high scores:', error.message);
      throw error;
    }
  }

  // Mock high scores for testing
  getMockHighScores(limit = 10) {
    const names = ['Alex Champion', 'Jordan Winner', 'Casey Pro', 'Morgan Ace', 'Riley Star', 
                   'Taylor Swift', 'Sam Master', 'Drew Legend', 'Jamie King', 'Quinn MVP'];
    
    return names.slice(0, limit).map((name, index) => ({
      id: `mock_${index}`,
      playerName: name,
      totalScore: Math.floor(Math.random() * 500) + 800 - (index * 30),
      lastUpdated: new Date().toISOString()
    })).sort((a, b) => b.totalScore - a.totalScore);
  }

  // ==================== SETTINGS OPERATIONS ====================

  // Get all settings
  async getSettings() {
    if (this.mockMode) {
      return { venue: { name: 'Demo Venue', location: 'Demo Location' }, email: {} };
    }

    try {
      const response = await fetch(`${this.baseUrl}/settings.json`);
      if (!response.ok) {
        return { venue: {}, email: {} };
      }
      const data = await response.json();
      return data || { venue: {}, email: {} };
    } catch (error) {
      console.error('Error fetching settings:', error.message);
      return { venue: {}, email: {} };
    }
  }

  // Save settings (venue or email)
  async saveSettings(type, settings) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would save settings:', { type, settings });
      return { success: true };
    }

    try {
      const response = await fetch(`${this.baseUrl}/settings/${type}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`✅ Settings saved: ${type}`);
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error.message);
      throw error;
    }
  }

  // ==================== USER MANAGEMENT ====================

  // Get all users
  async getUsers() {
    if (this.mockMode) {
      return {};
    }

    try {
      const settings = await this.getSettings();
      return settings.users || {};
    } catch (error) {
      console.error('Error fetching users:', error.message);
      return {};
    }
  }

  // Add or update a user
  async saveUser(userId, userData) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would save user:', { userId, userData });
      return { success: true };
    }

    try {
      const settings = await this.getSettings();
      const users = settings.users || {};
      
      // Validate PIN is 4 digits
      if (!/^\d{4}$/.test(userData.pin)) {
        throw new Error('PIN must be exactly 4 digits');
      }
      
      // Check if PIN is already used by another user
      const existingUsers = Object.entries(users);
      const pinConflict = existingUsers.find(([id, user]) => 
        user.pin === userData.pin && id !== userId
      );
      
      if (pinConflict) {
        throw new Error(`PIN ${userData.pin} is already assigned to ${pinConflict[1].name}`);
      }
      
      users[userId] = {
        name: userData.name,
        pin: userData.pin,
        management: userData.management === true
      };
      
      // Save users as part of settings
      settings.users = users;
      const response = await fetch(`${this.baseUrl}/settings.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ User saved: ${userData.name} (${userId})`);
      return { success: true };
    } catch (error) {
      console.error('Error saving user:', error.message);
      throw error;
    }
  }

  // Delete a user
  async deleteUser(userId) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would delete user:', userId);
      return { success: true };
    }

    try {
      const settings = await this.getSettings();
      const users = settings.users || {};
      
      if (!users[userId]) {
        throw new Error('User not found');
      }
      
      delete users[userId];
      
      // Save users as part of settings
      settings.users = users;
      const response = await fetch(`${this.baseUrl}/settings.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      console.log(`✅ User deleted: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error.message);
      throw error;
    }
  }

  // ==================== TRAINING PROGRESS OPERATIONS ====================

  // Get training progress for a specific user (by PIN)
  async getTrainingProgress(pin) {
    if (this.mockMode) {
      return {};
    }

    try {
      const storageKey = pin === 'default' ? 'default' : `pin_${pin}`;
      const response = await fetch(`${this.baseUrl}/trainingProgress/${storageKey}.json`);
      
      if (!response.ok) {
        return {};
      }
      
      const data = await response.json();
      return data || {};
    } catch (error) {
      console.error('Error fetching training progress:', error.message);
      return {};
    }
  }

  // Save training progress for a specific user (by PIN)
  async saveTrainingProgress(pin, completedModules) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would save training progress:', { pin, completedModules });
      return { success: true };
    }

    try {
      const storageKey = pin === 'default' ? 'default' : `pin_${pin}`;
      const response = await fetch(`${this.baseUrl}/trainingProgress/${storageKey}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completedModules)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ Training progress saved for PIN: ${pin}`);
      return { success: true };
    } catch (error) {
      console.error('Error saving training progress:', error.message);
      throw error;
    }
  }

  // Get all training progress (for admin view)
  async getAllTrainingProgress() {
    if (this.mockMode) {
      return {};
    }

    try {
      const response = await fetch(`${this.baseUrl}/trainingProgress.json`);
      
      if (!response.ok) {
        return {};
      }
      
      const data = await response.json();
      return data || {};
    } catch (error) {
      console.error('Error fetching all training progress:', error.message);
      return {};
    }
  }

  // ==================== UPDATE LOG TRACKING ====================

  // Get the latest update log version that a user has seen
  async getLastSeenUpdateVersion(pin) {
    if (this.mockMode) {
      return null;
    }

    try {
      const storageKey = pin === 'default' ? 'default' : `pin_${pin}`;
      const response = await fetch(`${this.baseUrl}/updateLogViews/${storageKey}/lastSeenVersion.json`);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data || null;
    } catch (error) {
      console.error('Error fetching last seen update version:', error.message);
      return null;
    }
  }

  // Mark an update log version as seen by a user
  async markUpdateVersionAsSeen(pin, version) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would mark update version as seen:', { pin, version });
      return { success: true };
    }

    try {
      const storageKey = pin === 'default' ? 'default' : `pin_${pin}`;
      const response = await fetch(`${this.baseUrl}/updateLogViews/${storageKey}/lastSeenVersion.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(version)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ Update version ${version} marked as seen for PIN: ${pin}`);
      return { success: true };
    } catch (error) {
      console.error('Error marking update version as seen:', error.message);
      throw error;
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  // Calculate total score for a team
  calculateTeamTotal(players) {
    return players.reduce((teamTotal, player) => {
      const playerTotal = Object.values(player.scores || {}).reduce((sum, holeScore) => {
        return sum + (holeScore.total || 0);
      }, 0);
      return teamTotal + playerTotal;
    }, 0);
  }

  // Calculate holes completed
  calculateHolesCompleted(players) {
    if (players.length === 0) return 0;
    
    // Get the minimum holes completed across all players
    return Math.min(...players.map(player => 
      Object.keys(player.scores || {}).length
    ));
  }

  // Calculate total score for an individual player
  calculatePlayerTotal(player) {
    return Object.values(player.scores || {}).reduce((sum, holeScore) => {
      return sum + (holeScore.total || 0);
    }, 0);
  }

  // ==================== MOCK DATA FUNCTIONS ====================

  getMockTeamData(rfid) {
    const holeNames = ['Plinko', 'SpinningTop', 'Haphazard', 'Roundhouse', 'HillHop', 'SkiJump', 'Mastermind', 'Igloo', 'Octagon', 'LoopDeLoop', 'UpAndOver', 'Lopside'];
    
    return {
      id: rfid,
      rfid: rfid,
      teamName: `Team ${rfid.slice(-4).toUpperCase()}`,
      players: [
        { 
          id: 'player1', 
          name: 'Player One',
          scores: this.generateMockScores(holeNames)
        },
        { 
          id: 'player2', 
          name: 'Player Two',
          scores: this.generateMockScores(holeNames)
        }
      ],
      totalScore: 0,
      holesCompleted: 0,
      lastActivity: new Date().toISOString()
    };
  }

  generateMockScores(holeNames = null) {
    if (!holeNames) {
      holeNames = ['Plinko', 'SpinningTop', 'Haphazard', 'Roundhouse', 'HillHop', 'SkiJump', 'Mastermind', 'Igloo', 'Octagon', 'LoopDeLoop', 'UpAndOver', 'Lopside'];
    }
    
    const scores = {};
    const numHoles = Math.floor(Math.random() * 8) + 3; // 3-10 holes completed
    
    for (let i = 0; i < numHoles; i++) {
      const holeId = holeNames[i];
      const numThrows = Math.floor(Math.random() * 3) + 1; // 1-3 throws
      const throws = [];
      let total = 0;
      
      for (let j = 0; j < numThrows; j++) {
        const score = Math.floor(Math.random() * 100) + 10; // 10-109 points
        throws.push(score);
        total += score;
      }
      
      scores[holeId] = {
        throws: throws,
        total: total
      };
    }
    
    return scores;
  }

  getMockLeaderboard(limit) {
    const mockTeams = [];
    for (let i = 0; i < limit; i++) {
      const rfid = `mock${String(i + 1).padStart(3, '0')}`;
      const teamData = this.getMockTeamData(rfid);
      teamData.totalScore = this.calculateTeamTotal(teamData.players);
      teamData.holesCompleted = this.calculateHolesCompleted(teamData.players);
      mockTeams.push(teamData);
    }
    
    // Sort by total score
    return mockTeams.sort((a, b) => b.totalScore - a.totalScore);
  }
}

module.exports = new FirebaseRestService();
