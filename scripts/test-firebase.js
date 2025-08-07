#!/usr/bin/env node

// Test Firebase Connection Script
const { testConnection, getDatabase } = require('../config/firebase');

async function testFirebaseConnection() {
  console.log('🔥 Testing Firebase connection...');
  console.log('📍 Database URL: https://swingcity-6cad7-default-rtdb.europe-west1.firebasedatabase.app/');
  
  try {
    // Test basic connection
    const result = await testConnection();
    console.log('Connection result:', result);
    
    if (result.connected) {
      console.log('✅ Firebase connection successful!');
      
      // Try to read some sample data
      const db = getDatabase();
      if (db) {
        console.log('🔍 Attempting to read data structure...');
        
        // Read the root structure
        const rootSnapshot = await db.ref('/').limitToFirst(5).once('value');
        if (rootSnapshot.exists()) {
          const data = rootSnapshot.val();
          console.log('📊 Database structure preview:');
          console.log(Object.keys(data));
          
          // Check for teams
          if (data.teams) {
            const teamCount = Object.keys(data.teams).length;
            console.log(`👥 Found ${teamCount} teams in database`);
          }
          
          // Check for scores
          if (data.scores) {
            const scoreCount = Object.keys(data.scores).length;
            console.log(`🎯 Found ${scoreCount} score records in database`);
          }
        } else {
          console.log('📭 Database appears to be empty');
        }
      }
    } else {
      console.log('❌ Firebase connection failed:', result.error);
      console.log('\n💡 Possible solutions:');
      console.log('   1. Check your Firebase service account key file');
      console.log('   2. Verify environment variables are set correctly');
      console.log('   3. Ensure Firebase project permissions are correct');
      console.log('   4. Check internet connection');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Debug info:');
    console.log('   - Node version:', process.version);
    console.log('   - Working directory:', process.cwd());
    console.log('   - Environment variables:');
    console.log('     FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✓ Set' : '❌ Not set');
    console.log('     FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✓ Set' : '❌ Not set');
    console.log('     FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✓ Set' : '❌ Not set');
  }
}

// Run the test
testFirebaseConnection()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test script error:', error.message);
    process.exit(1);
  });
