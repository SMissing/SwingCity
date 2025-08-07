#!/usr/bin/env node

// Simple Firebase Connection Test
require('dotenv').config();

async function testSimpleConnection() {
  console.log('🔥 Testing simple Firebase connection...');
  console.log('📍 Database URL:', process.env.FIREBASE_DATABASE_URL);
  
  try {
    // Try using the Firebase REST API first to test accessibility
    const fetch = require('node-fetch');
    const testUrl = `${process.env.FIREBASE_DATABASE_URL}/.json`;
    
    console.log('🌐 Testing REST API access...');
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ REST API connection successful!');
      console.log('📊 Database structure:');
      
      if (data && typeof data === 'object') {
        const keys = Object.keys(data);
        console.log('Root keys:', keys);
        
        // Check for specific structures
        if (data.teams) {
          console.log(`👥 Teams found: ${Object.keys(data.teams).length}`);
        }
        if (data.scores) {
          console.log(`🎯 Scores found: ${Object.keys(data.scores).length}`);
        }
        if (data.games) {
          console.log(`🎮 Games found: ${Object.keys(data.games).length}`);
        }
      } else {
        console.log('📭 Database appears to be empty or null');
      }
      
      console.log('\n✨ Great! Your database is accessible via REST API');
      console.log('💡 This means we can implement Firebase integration');
      
    } else {
      console.log(`❌ REST API failed with status: ${response.status}`);
      console.log(`Error: ${response.statusText}`);
      
      if (response.status === 401) {
        console.log('🔐 Authentication required - you need to set up service account credentials');
      } else if (response.status === 403) {
        console.log('🚫 Access forbidden - check your Firebase database rules');
      }
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('🌐 DNS lookup failed - check your internet connection');
    } else {
      console.log('🔧 Unexpected error occurred');
    }
  }
}

// Check if node-fetch is available, install if not
async function ensureFetch() {
  try {
    require('node-fetch');
    return true;
  } catch (error) {
    console.log('📦 Installing node-fetch for testing...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install node-fetch@2', { stdio: 'inherit' });
      return true;
    } catch (installError) {
      console.error('❌ Failed to install node-fetch:', installError.message);
      return false;
    }
  }
}

// Run the test
async function main() {
  const fetchAvailable = await ensureFetch();
  if (fetchAvailable) {
    await testSimpleConnection();
  } else {
    console.log('❌ Cannot run test without node-fetch');
  }
  
  console.log('\n🏁 Test completed');
}

main().catch(console.error);
