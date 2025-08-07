# SwingCity V2 - Interactive Crazy Golf Scoring System

A modern Node.js web application for interactive crazy golf scoring, built with real-time communication between Raspberry Pi sensors and tablet displays.

## � Features

- **Real-time Scoring**: Instant score updates across all tablets
- **Multi-hole Support**: Manages 12 concurrent crazy golf holes
- **RFID Integration**: Team identification via RFID cards
- **Raspberry Pi Ready**: API endpoints for Pi Pico 2 W sensors
- **Admin Dashboard**: Real-time monitoring and control
- **Staff-Proof Design**: Simple card tap to start, automatic game flow
- **Responsive Tablets**: Full-screen interface for each hole

## 🏌️ System Overview

The system consists of:
- **Central Node.js Server** with Socket.io for real-time communication
- **Tablet Interface** (one per hole) showing live game state
- **Admin Dashboard** for monitoring and control
- **Raspberry Pi Pico 2 W** sensors for RFID and IR detection
- **Firebase Integration** for player and score storage

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Navigate to the project directory:

   ```bash
   cd SwingCity_V2
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   Or start the production server:

   ```bash
   npm start
   ```

4. Open your browser and visit:

   ```
   http://localhost:3001
   ```

## 📁 Project Structure

```
SwingCity_V2/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── config/
│   └── holes.js          # Hole configurations and scoring
├── views/                # EJS templates
│   ├── layout.ejs        # Main layout template
│   ├── tablet.ejs        # Tablet interface for each hole
│   ├── admin.ejs         # Admin dashboard
│   ├── 404.ejs          # 404 error page
│   └── error.ejs        # General error page
└── public/              # Static assets
    ├── css/
    │   └── style.css     # Custom styles
    └── js/
        ├── main.js       # Common utilities
        ├── tablet.js     # Tablet interface logic
        └── admin.js      # Admin dashboard logic
```

## 🛠️ Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with nodemon (auto-restart)
- `npm test` - Run tests (placeholder)

## 🌐 Routes

- `GET /` - Redirects to admin dashboard
- `GET /admin` - Admin dashboard for monitoring
- `GET /tablet/:holeId` - Tablet interface for specific hole
- `GET /api/health` - System health check
- `POST /api/rfid/tap` - RFID card tap endpoint (for Pi Picos)
- `POST /api/score/input` - Score input endpoint (for Pi Picos)

## � Configured Holes

The system supports 12 crazy golf holes with unique scoring:

1. **Plinko** - 25, 50, 100 points
2. **Spinning Top** - Variable scoring with penalties
3. **Haphazard** - 25, 50, 100, -50 points
4. **Roundhouse** - 25, 50, 100 points
5. **Hill Hop** - 25, 50, 100 points
6. **Ski Jump** - Wide range including penalties
7. **Mastermind** - Quiz-based scoring (True/False questions)
8. **Igloo** - 25, 50, 100 points
9. **Octagon** - Complex scoring system
10. **Loop De Loop** - Including loop bonus and penalties
11. **Up & Over** - 25, 50, 100 points
12. **Lopsided** - Including penalty zones

## � Raspberry Pi Integration

The system is designed to work with Raspberry Pi Pico 2 W devices that handle:
- **RFID Reading**: Team identification
- **IR Sensors**: Score detection in goals
- **HTTP Communication**: Sending data to the central server

### API Endpoints for Pi Picos

**RFID Card Tap:**
```bash
POST /api/rfid/tap
Content-Type: application/json

{
  "rfid": "1234567890",
  "holeId": "Plinko",
  "picoId": "pico-plinko-001"
}
```

**Score Input:**
```bash
POST /api/score/input
Content-Type: application/json

{
  "rfid": "1234567890",
  "holeId": "Plinko", 
  "score": 50,
  "throwNumber": 1,
  "picoId": "pico-plinko-001"
}
```

## 🎮 Game Flow

1. **Team arrives at hole** and taps RFID card
2. **System loads team players** from Firebase
3. **Players take turns** (3 shots each)
4. **Pi Pico detects scores** and sends to server
5. **Scores update in real-time** on tablet
6. **Game completes automatically** when all players finish
7. **Scores saved to Firebase** and tablet resets

## 🔧 Admin Features

- **Real-time hole monitoring** - See all active games
- **System health dashboard** - Monitor connections and performance
- **Remote hole reset** - Fix issues without physical access
- **API testing tools** - Simulate RFID taps and scores
- **Live system logs** - Track all activities
- **Export functionality** - Download logs and reports

## 🚀 Deployment

The application is ready for deployment on:
- Local servers
- Cloud platforms (Heroku, DigitalOcean, AWS)
- Raspberry Pi 4 (for local hosting)

Set the `PORT` environment variable for production deployments.

## � Configuration

Hole configurations and scoring can be modified in `config/holes.js`.
Game settings like max throws and timeouts are in the same file.

## 📄 License

MIT License - Built for SwingCity crazy golf entertainment.

---

**Ready for Action!** 🎯⛳�️
