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
    console.log('🔥 Initializing Firebase REST Service...');
    
    try {
      // Test the connection
      const response = await fetch(`${this.baseUrl}/.json`);
      if (response.ok) {
        console.log('✅ Firebase REST Service initialized successfully');
        this.mockMode = false;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Firebase REST Service initialization failed:', error.message);
      console.log('🚨 Running in MOCK MODE');
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

      console.log('🔍 Found RFID card:', cardData);

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

      return {
        id: rfid,
        rfid: rfid,
        teamName: teamName,
        players: players,
        totalScore: this.calculateTeamTotal(players),
        holesCompleted: this.calculateHolesCompleted(players),
        lastActivity: cardData.lastActivity || new Date().toISOString()
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

      // Update holes completed based on scores
      if (currentTeam.holesCompleted) {
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
  async createOrUpdateTeam(rfid, teamName, players) {
    if (this.mockMode) {
      console.log('🚨 MOCK MODE: Would create/update team:', { rfid, teamName, players });
      return { id: rfid, rfid, teamName, players, created: new Date().toISOString() };
    }

    try {
      // Prepare the team data structure
      const teamData = {
        rfid: rfid,
        teamName: teamName,
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
    const { HOLES } = require('../config/holes');
    const holeNames = Object.keys(HOLES);
    
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
      const { HOLES } = require('../config/holes');
      holeNames = Object.keys(HOLES);
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
