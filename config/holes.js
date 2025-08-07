// SwingCity V2 Hole Configuration
// Based on actual scoring data from Firebase

const HOLES = {
  'Plinko': {
    name: 'Plinko',
    displayName: 'Plinko',
    scoring: [25, 50, 100],
    description: 'Drop the ball and watch it bounce!'
  },
  'SpinningTop': {
    name: 'SpinningTop', 
    displayName: 'Spinning Top',
    scoring: [-75, -25, 50, 100, 200], // From database analysis
    description: 'Navigate the spinning obstacles'
  },
  'Haphazard': {
    name: 'Haphazard',
    displayName: 'Haphazard', 
    scoring: [-50, 25, 50, 100],
    description: 'Chaos and skill combined'
  },
  'Roundhouse': {
    name: 'Roundhouse',
    displayName: 'Roundhouse',
    scoring: [25, 50, 100],
    description: 'Round and round we go'
  },
  'HillHop': {
    name: 'HillHop',
    displayName: 'Hill Hop',
    scoring: [25, 50, 100],
    description: 'Up and over the hills'
  },
  'SkiJump': {
    name: 'SkiJump',
    displayName: 'Ski Jump',
    scoring: [-150, -75, -50, -25, 25, 50, 75, 100, 200, 250], // From database analysis
    description: 'Take the leap of faith'
  },
  'Mastermind': {
    name: 'Mastermind',
    displayName: 'Mastermind',
    scoring: {
      'True25': 25,
      'True50': 50, 
      'True100': 100,
      'False25': -25,
      'False50': -50,
      'False100': -100
    },
    description: 'Test your knowledge for points',
    isQuiz: true
  },
  'Igloo': {
    name: 'Igloo',
    displayName: 'Igloo',
    scoring: [25, 50, 100],
    description: 'Keep it cool in the igloo'
  },
  'Octagon': {
    name: 'Octagon',
    displayName: 'Octagon',
    scoring: [-25, 25, 50, 75, 100, 125, 150, 175, 225, 250, 300], // From database analysis
    description: 'Eight sides of challenge'
  },
  'LoopDeLoop': {
    name: 'LoopDeLoop', 
    displayName: 'Loop De Loop',
    scoring: [-75, -25, 25, 100, 150, 225],
    description: 'Go for the loop!'
  },
  'UpAndOver': {
    name: 'UpAndOver',
    displayName: 'Up & Over', 
    scoring: [25, 50, 100],
    description: 'Up and over the obstacle'
  },
  'Lopside': {
    name: 'Lopside',
    displayName: 'Lopsided',
    scoring: [-50, 25, 50, 100],
    description: 'Nothing is quite straight here'
  }
};

// Game configuration
const GAME_CONFIG = {
  MAX_THROWS: 3,
  MAX_CONCURRENT_TEAMS: 12,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  RFID_TIMEOUT: 5000, // 5 seconds for RFID read
  SCORE_TIMEOUT: 10000 // 10 seconds for score processing
};

// Tablet/Hole mapping (you can customize this)
const HOLE_ASSIGNMENTS = {
  'tablet-1': 'Plinko',
  'tablet-2': 'SpinningTop',
  'tablet-3': 'Haphazard', 
  'tablet-4': 'Roundhouse',
  'tablet-5': 'HillHop',
  'tablet-6': 'SkiJump',
  'tablet-7': 'Mastermind',
  'tablet-8': 'Igloo',
  'tablet-9': 'Octagon',
  'tablet-10': 'LoopDeLoop',
  'tablet-11': 'UpAndOver',
  'tablet-12': 'Lopside'
};

module.exports = {
  HOLES,
  GAME_CONFIG,
  HOLE_ASSIGNMENTS
};
