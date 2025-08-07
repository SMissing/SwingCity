// Firebase Configuration for SwingCity V2
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
// You'll need to add your service account key file or use environment variables
let db = null;

function initializeFirebase() {
  try {
    // Option 1: Using environment variables (recommended for production)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('🔥 Initializing Firebase with environment variables');
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL
          }),
          databaseURL: process.env.FIREBASE_DATABASE_URL || "https://swingcity-6cad7-default-rtdb.europe-west1.firebasedatabase.app/"
        });
      }
    }
    // Option 2: Using service account key file (for development)
    else if (require('fs').existsSync('./config/swingcity-service-account-key.json')) {
      console.log('🔥 Initializing Firebase with service account key file');
      
      const serviceAccount = require('./swingcity-service-account-key.json');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: "https://swingcity-6cad7-default-rtdb.europe-west1.firebasedatabase.app/"
        });
      }
    }
    // Option 3: Try direct database connection (for testing with public database)
    else if (process.env.FIREBASE_DATABASE_URL) {
      console.log('🔥 Attempting direct Firebase database connection');
      
      if (!admin.apps.length) {
        // For testing purposes - this might work if the database has public read access
        admin.initializeApp({
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
      }
    }
    // Fallback: Application Default Credentials (for Google Cloud)
    else {
      console.log('🔥 Initializing Firebase with Application Default Credentials');
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL: "https://swingcity-6cad7-default-rtdb.europe-west1.firebasedatabase.app/"
        });
      }
    }

    db = admin.database();
    console.log('🔥 Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('📝 Running in mock data mode');
    console.log('💡 To connect to Firebase:');
    console.log('   1. Add your service account key to config/swingcity-service-account-key.json');
    console.log('   2. Or set environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
    return null;
  }
}

// Get Firebase database instance
function getDatabase() {
  if (!db) {
    db = initializeFirebase();
  }
  return db;
}

// Test Firebase connection
async function testConnection() {
  try {
    const database = getDatabase();
    if (!database) {
      return { connected: false, error: 'Database not initialized' };
    }

    // Try to read from the root to test connection
    const snapshot = await database.ref('/').limitToFirst(1).once('value');
    return { 
      connected: true, 
      message: 'Firebase connection successful',
      hasData: snapshot.exists()
    };
  } catch (error) {
    return { 
      connected: false, 
      error: error.message 
    };
  }
}

module.exports = {
  initializeFirebase,
  getDatabase,
  testConnection,
  admin
};
