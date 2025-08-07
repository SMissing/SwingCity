// Firebase Database Service for SwingCity V2
const { getDatabase } = require('../config/firebase');

class FirebaseService {
  constructor() {
    this.db = null;
    this.mockMode = false;
  }

  // Initialize the service
  async initialize() {
    this.db = getDatabase();
    this.mockMode = !this.db;
    
    if (this.mockMode) {
      console.log('🚨 Running in MOCK MODE - Firebase not available');
    }
  }

  // ==================== TEAM OPERATIONS ====================

  // Get team data by RFID
  async getTeamByRFID(rfid) {
    if (this.mockMode) {
      return this.getMockTeamData(rfid);
    }

    try {
      // Look for team in Firebase by RFID
      const snapshot = await this.db.ref(`teams`).orderByChild('rfid').equalTo(rfid).once('value');
      
      if (!snapshot.exists()) {
        throw new Error(`Team with RFID ${rfid} not found`);
      }

      const teams = snapshot.val();
      const teamId = Object.keys(teams)[0];
      const teamData = teams[teamId];

      // Get players for this team
      const playersSnapshot = await this.db.ref(`teams/${teamId}/players`).once('value');
      const players = playersSnapshot.exists() ? Object.values(playersSnapshot.val()) : [];

      // Get scores for each player
      for (let player of players) {
        const scoresSnapshot = await this.db.ref(`scores/${player.id}`).once('value');
        player.scores = scoresSnapshot.exists() ? scoresSnapshot.val() : {};
      }

      return {
        id: teamId,
        rfid: rfid,
        teamName: teamData.name || `Team ${rfid.slice(-4).toUpperCase()}`,
        players: players,
        totalScore: this.calculateTeamTotal(players),
        holesCompleted: this.calculateHolesCompleted(players),
        lastActivity: teamData.lastActivity || new Date().toISOString()
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
      const teamRef = this.db.ref(`teams/${teamData.id || teamData.rfid}`);
      await teamRef.set({
        name: teamData.teamName,
        rfid: teamData.rfid,
        lastActivity: new Date().toISOString(),
        players: teamData.players.reduce((acc, player) => {
          acc[player.id] = {
            id: player.id,
            name: player.name
          };
          return acc;
        }, {})
      });

      console.log(`✅ Team ${teamData.rfid} saved to Firebase`);
      return teamData;
    } catch (error) {
      console.error(`❌ Error saving team:`, error.message);
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
      const scoreRef = this.db.ref(`scores/${playerId}/${holeId}`);
      await scoreRef.set({
        throws: scoreData.throws,
        total: scoreData.total,
        timestamp: new Date().toISOString()
      });

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
      const snapshot = await this.db.ref(`scores/${playerId}`).once('value');
      return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
      console.error(`❌ Error getting player scores:`, error.message);
      return {};
    }
  }

  // ==================== LEADERBOARD OPERATIONS ====================

  // Get top teams for leaderboard
  async getLeaderboard(limit = 10) {
    if (this.mockMode) {
      return this.getMockLeaderboard(limit);
    }

    try {
      // This is a simplified version - you might want to implement
      // a more sophisticated ranking system
      const teamsSnapshot = await this.db.ref('teams').once('value');
      
      if (!teamsSnapshot.exists()) {
        return [];
      }

      const teams = teamsSnapshot.val();
      const leaderboard = [];

      for (let [teamId, teamData] of Object.entries(teams)) {
        const playersSnapshot = await this.db.ref(`teams/${teamId}/players`).once('value');
        const players = playersSnapshot.exists() ? Object.values(playersSnapshot.val()) : [];

        // Get scores for each player
        let totalScore = 0;
        let holesCompleted = 0;

        for (let player of players) {
          const scoresSnapshot = await this.db.ref(`scores/${player.id}`).once('value');
          const scores = scoresSnapshot.exists() ? scoresSnapshot.val() : {};
          
          Object.values(scores).forEach(holeScore => {
            totalScore += holeScore.total || 0;
          });

          holesCompleted = Math.max(holesCompleted, Object.keys(scores).length);
        }

        leaderboard.push({
          teamId: teamId,
          teamName: teamData.name,
          rfid: teamData.rfid,
          totalScore: totalScore,
          holesCompleted: holesCompleted,
          playerCount: players.length
        });
      }

      // Sort by total score (descending) and holes completed
      return leaderboard
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) {
            return b.totalScore - a.totalScore;
          }
          return b.holesCompleted - a.holesCompleted;
        })
        .slice(0, limit);

    } catch (error) {
      console.error(`❌ Error getting leaderboard:`, error.message);
      return [];
    }
  }

  // ==================== GAME SESSION OPERATIONS ====================

  // Save active game session
  async saveGameSession(sessionData) {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would save game session:', sessionData.rfid);
      return;
    }

    try {
      const sessionRef = this.db.ref(`activeSessions/${sessionData.rfid}`);
      await sessionRef.set({
        holeId: sessionData.holeId,
        currentPlayerIndex: sessionData.currentPlayerIndex,
        currentThrow: sessionData.currentThrow,
        status: sessionData.status,
        startTime: sessionData.startTime,
        lastActivity: sessionData.lastActivity
      });

      console.log(`✅ Game session saved: ${sessionData.rfid}`);
    } catch (error) {
      console.error(`❌ Error saving game session:`, error.message);
      throw error;
    }
  }

  // Remove completed game session
  async removeGameSession(rfid) {
    if (this.mockMode) {
      console.log('🔄 MOCK: Would remove game session:', rfid);
      return;
    }

    try {
      await this.db.ref(`activeSessions/${rfid}`).remove();
      console.log(`✅ Game session removed: ${rfid}`);
    } catch (error) {
      console.error(`❌ Error removing game session:`, error.message);
    }
  }

  // ==================== HELPER METHODS ====================

  calculateTeamTotal(players) {
    return players.reduce((total, player) => {
      const playerTotal = Object.values(player.scores || {}).reduce((sum, holeScore) => {
        return sum + (holeScore.total || 0);
      }, 0);
      return total + playerTotal;
    }, 0);
  }

  calculateHolesCompleted(players) {
    if (!players.length) return 0;
    
    return Math.max(...players.map(player => 
      Object.keys(player.scores || {}).length
    ));
  }

  // ==================== MOCK DATA METHODS ====================

  getMockTeamData(rfid) {
    const { HOLES } = require('./holes');
    
    return {
      rfid: rfid,
      teamName: `Team ${rfid.slice(-4).toUpperCase()}`,
      players: [
        { 
          id: `${rfid}_player1`, 
          name: 'Player One',
          scores: this.generateMockScores()
        },
        { 
          id: `${rfid}_player2`, 
          name: 'Player Two',
          scores: this.generateMockScores()
        }
      ],
      totalScore: 0,
      holesCompleted: 0,
      lastActivity: new Date().toISOString()
    };
  }

  generateMockScores() {
    const { HOLES } = require('./holes');
    const scores = {};
    const holeNames = Object.keys(HOLES);
    
    // Generate scores for random holes (simulating partial gameplay)
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
    for (let i = 1; i <= limit; i++) {
      mockTeams.push({
        teamId: `mock_team_${i}`,
        teamName: `Mock Team ${i}`,
        rfid: `mock${i.toString().padStart(6, '0')}`,
        totalScore: Math.floor(Math.random() * 1000) + 500,
        holesCompleted: Math.floor(Math.random() * 12) + 1,
        playerCount: 2
      });
    }
    
    return mockTeams.sort((a, b) => b.totalScore - a.totalScore);
  }
}

// Create singleton instance
const firebaseService = new FirebaseService();

module.exports = firebaseService;
