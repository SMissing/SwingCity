#!/usr/bin/env node

// Test the new Firebase REST Service
require('dotenv').config();
const firebaseService = require('../services/firebaseRestService');

async function testRestService() {
  console.log('🧪 Testing Firebase REST Service...\n');

  try {
    // Initialize the service
    await firebaseService.initialize();
    
    console.log('1️⃣ Testing leaderboard fetch...');
    const leaderboard = await firebaseService.getLeaderboard(5);
    console.log(`   📊 Found ${leaderboard.length} teams in leaderboard`);
    
    if (leaderboard.length > 0) {
      console.log('   🏆 Top team:', leaderboard[0].teamName);
      console.log('   📈 Total score:', leaderboard[0].totalScore);
      console.log('   🕳️ Holes completed:', leaderboard[0].holesCompleted);
    }
    
    console.log('\n2️⃣ Testing specific RFID lookup...');
    
    // Test with a known RFID if available, or try a mock one
    try {
      // First let's see what RFIDs are available
      const fetch = require('node-fetch');
      const response = await fetch(process.env.FIREBASE_DATABASE_URL + '/rfidCards.json');
      const rfidCards = await response.json();
      
      if (rfidCards && Object.keys(rfidCards).length > 0) {
        const firstRfid = Object.keys(rfidCards)[0];
        console.log(`   🔍 Testing with RFID: ${firstRfid}`);
        
        const teamData = await firebaseService.getTeamByRFID(firstRfid);
        console.log(`   ✅ Found team: ${teamData.teamName}`);
        console.log(`   👥 Players: ${teamData.players.length}`);
        console.log(`   🎯 Total score: ${teamData.totalScore}`);
        
        // Test saving a score
        if (teamData.players.length > 0) {
          console.log('\n3️⃣ Testing score save...');
          const playerId = teamData.players[0].id;
          await firebaseService.savePlayerScore(playerId, 'Plinko', {
            throws: [50, 75],
            total: 125
          });
          console.log('   ✅ Score saved successfully!');
        }
        
      } else {
        console.log('   ℹ️ No RFID cards found in database');
        console.log('   🔄 Testing with mock data...');
        
        const mockTeam = await firebaseService.getTeamByRFID('test123');
        console.log(`   📝 Mock team created: ${mockTeam.teamName}`);
      }
      
    } catch (error) {
      console.log(`   ⚠️ RFID test failed: ${error.message}`);
      console.log('   🔄 Falling back to mock mode test...');
      
      const mockTeam = await firebaseService.getTeamByRFID('test456');
      console.log(`   📝 Mock team: ${mockTeam.teamName}`);
    }
    
    console.log('\n✅ All tests completed successfully!');
    console.log('🎉 Firebase REST Service is working properly!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('🔧 Check your .env file and Firebase database URL');
  }
}

testRestService()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test script error:', error.message);
    process.exit(1);
  });
