# SwingCity V2 - Team & Leaderboard Management System

A modern web-based management platform for SwingCity interactive arcade golf, featuring real-time leaderboards, team management, scorecard emailing, and Unity game integration.

## 🎯 Overview

SwingCity V2 is a centralized web application that manages teams, tracks scores, displays leaderboards, and handles scorecard distribution for an interactive arcade golf experience. The system integrates with Unity games to receive scores in real-time and provides a beautiful dashboard interface for staff and venue management.

## ✨ Features

### Core Functionality
- **Team Management**: Create and manage teams using RFID cards with player registration
- **Real-time Leaderboard**: Live updating leaderboard display with team rankings
- **High Scores**: All-time high score tracking for individual players
- **Podium Display**: Winner celebration screen showing top 3 players from a team
- **Scorecard Email**: Automated email scorecards with discount codes to teams
- **Unity Integration**: REST API endpoints for Unity games to submit scores
- **Settings Management**: Configure venue information and email service settings
- **PIN Protection**: Secure PIN-locked dashboard for staff access

### Additional Features
- **Training Page**: Staff and management guides
- **App Download**: Centralized location for downloading tablet app updates
- **Real-time Updates**: Socket.io powered live updates across all displays
- **Firebase Integration**: Cloud-based data storage using Firebase REST API
- **Responsive Design**: Modern, dark-themed UI that works on all devices

## 🏗️ System Architecture

The system consists of:
- **Node.js/Express Server**: Main backend server with REST API
- **Socket.io**: Real-time bidirectional communication
- **Firebase REST API**: Cloud database for teams, scores, and settings
- **EJS Templates**: Server-side rendered views
- **Modern Web UI**: Dark-themed, responsive interface

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- Firebase Realtime Database (configured via environment variables)

### Installation

1. Clone or navigate to the project directory:

   ```bash
   cd SwingCity
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:

   ```env
   PORT=3001
   FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
   SITE_PIN=5656
   NODE_ENV=development
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   Or start the production server:

   ```bash
   npm start
   ```

5. Open your browser and visit:

   ```
   http://localhost:3001
   ```

   You'll be prompted to enter the PIN (default: `5656`)

## 📁 Project Structure

```
SwingCity/
├── server.js                 # Main Express server and API endpoints
├── package.json              # Dependencies and scripts
├── services/
│   ├── firebaseRestService.js  # Firebase REST API service
│   └── sendScoresEmail.js       # Email service utilities
├── views/                    # EJS templates
│   ├── dashboard.ejs        # Main dashboard/homepage
│   ├── team-creator.ejs     # Team creation and management
│   ├── leaderboard.ejs     # Live leaderboard display
│   ├── highscores.ejs      # All-time high scores
│   ├── podium.ejs          # Winner podium display
│   ├── settings.ejs        # Settings configuration
│   ├── training.ejs        # Training materials
│   ├── download.ejs        # App download page
│   ├── layout.ejs          # Base layout template
│   ├── 404.ejs             # 404 error page
│   ├── error.ejs           # General error page
│   └── partials/
│       └── pin-lock.ejs    # PIN lock component
└── public/                  # Static assets
    ├── css/
    │   ├── style.css       # Main stylesheet
    │   └── pin-lock.css    # PIN lock styles
    ├── js/
    │   ├── main.js         # Common utilities
    │   ├── pin-lock.js     # PIN authentication
    │   ├── podium.js       # Podium display logic
    │   └── team-creator.js # Team management logic
    ├── images/             # Images and logos
    ├── fonts/              # Custom fonts
    ├── sounds/             # Audio files
    └── Downloads/          # Downloadable files (APKs, etc.)
```

## 🛠️ Available Scripts

- `npm start` - Start the production server (Electron launcher if configured)
- `npm run dev` - Start the development server with nodemon (auto-restart)
- `npm run pack` - Build Electron app (directory)
- `npm run dist` - Build Electron app (distributable)

## 🌐 Routes

### Public Routes
- `GET /` - Dashboard (PIN protected)
- `GET /teams` - Team creator/manager
- `GET /leaderboard` - Live leaderboard display
- `GET /highscores` - All-time high scores
- `GET /podium` - Podium winner display
- `GET /settings` - Settings configuration
- `GET /training` - Training materials
- `GET /download` - App download page

### API Endpoints

#### Team Management
- `GET /api/teams` - Get all teams
- `POST /api/teams` - Create a new team
- `GET /api/team/:rfid` - Get team data by RFID
- `PUT /api/teams/:rfid` - Update team data
- `DELETE /api/teams/:rfid` - Delete a team

#### Leaderboard & Scores
- `GET /api/leaderboard?limit=25` - Get leaderboard data
- `GET /api/highscores?limit=25` - Get top high scores
- `POST /api/highscores` - Save a high score manually
- `POST /api/highscores/sync` - Sync all players to high scores
- `DELETE /api/highscores/cleanup-zeros` - Remove zero-score entries
- `GET /api/podium/:rfid` - Get top 3 players for a team

#### Unity Game Integration
- `POST /api/unity/score` - Update player score from Unity
- `POST /api/unity/refresh-leaderboard` - Trigger leaderboard refresh
- `POST /api/unity/show-podium` - Trigger podium display

#### Email & Scorecards
- `POST /api/email-scorecard` - Send scorecard email to team

#### Settings
- `GET /api/settings` - Get all settings
- `POST /api/settings/venue` - Save venue settings
- `POST /api/settings/email` - Save email settings
- `POST /api/settings/email/test` - Test email configuration

#### System
- `GET /api/health` - System health check
- `POST /api/verify-pin` - Verify PIN for dashboard access
- `GET /api/downloads` - List downloadable files

## 🎮 Unity Game Integration

The system provides REST API endpoints for Unity games to submit scores and trigger displays:

### Submit Score
```bash
POST /api/unity/score
Content-Type: application/json

{
  "rfid": "1234567890",
  "playerId": "player@example.com",
  "holeId": "Plinko",
  "score": 50,
  "throws": [25, 25]
}
```

### Refresh Leaderboard
```bash
POST /api/unity/refresh-leaderboard
```

### Show Podium
```bash
POST /api/unity/show-podium
Content-Type: application/json

{
  "rfid": "1234567890"
}
```

## 📧 Email Scorecard Feature

The system can automatically email scorecards to teams after their game:

1. Teams can provide an email address during registration
2. Staff can trigger scorecard emails from the Team Manager
3. Emails include:
   - Team name and total score
   - Individual player scores
   - Hole-by-hole breakdown
   - Winner highlight
   - Discount code for next visit (SWING10)

Email settings are configured in the Settings page and require:
- SMTP host
- Port
- Username/password
- From name

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
PORT=3001
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
SITE_PIN=5656
NODE_ENV=development
```

### Firebase Database Structure

The system expects the following Firebase structure:

```
firebase-database/
├── rfidCards/
│   └── {rfid}/
│       ├── teamName
│       ├── teamEmail
│       ├── players/
│       │   └── {email}/
│       │       ├── displayName
│       │       ├── scorePerHole/
│       │       │   └── {holeName}/
│       │       │       ├── throws: []
│       │       │       └── total: 0
│       │       └── totalScoreForThisVisit
│       └── holesCompleted/
├── highScores/
│   └── {sanitizedEmail}/
│       ├── playerId
│       ├── playerName
│       ├── totalScore
│       └── rfid
└── settings/
    ├── venue/
    │   ├── name
    │   └── location
    └── email/
        ├── host
        ├── port
        ├── secure
        ├── user
        ├── pass
        └── fromName
```

## 🎨 UI Features

- **Dark Theme**: Modern dark UI with neon accents
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Socket.io powered live updates
- **PIN Protection**: Secure access control
- **Animated Transitions**: Smooth UI animations
- **Custom Fonts**: Bebas Neue, Space Grotesk, and custom fonts

## 🔐 Security

- PIN-protected dashboard access
- Session-based authentication
- Environment variable configuration for sensitive data
- Firebase REST API (no client-side credentials)

## 🚀 Deployment

The application can be deployed on:
- Local servers
- Cloud platforms (Heroku, DigitalOcean, AWS, etc.)
- Raspberry Pi 4 (for local hosting)
- Docker containers

Set the `PORT` environment variable for production deployments.

### Electron Launcher

The project includes Electron configuration for creating a desktop launcher application. Build with:

```bash
npm run dist
```

## 📝 Game Holes

The system supports 12 crazy golf holes:
1. Plinko
2. SpinningTop
3. Haphazard
4. Roundhouse
5. HillHop
6. SkiJump
7. Mastermind
8. Igloo
9. Octagon
10. LoopDeLoop
11. UpAndOver
12. Lopside

## 🔄 Real-time Features

- **Socket.io Events**:
  - `scoreUpdated` - Score changes broadcast
  - `teamUpdated` - Team data changes
  - `leaderboardRefresh` - Leaderboard refresh trigger
  - `highScoreUpdated` - High score updates
  - `showPodium` - Podium display trigger
  - `displayTeamScorecard` - Show team scorecard on leaderboard
  - `hideTeamScorecard` - Hide scorecard from leaderboard

## 🐛 Troubleshooting

### Firebase Connection Issues
- Verify `FIREBASE_DATABASE_URL` in `.env`
- Check Firebase database rules allow REST API access
- System will run in mock mode if Firebase is unavailable

### Email Not Sending
- Verify email settings in Settings page
- Test email configuration using the test button
- Check SMTP credentials and firewall settings

### PIN Not Working
- Default PIN is `5656` (set via `SITE_PIN` env variable)
- Clear browser session storage if locked out

## 📄 License

MIT License - Built for SwingCity interactive arcade golf entertainment.

---

**Ready to manage your SwingCity experience!** 🏌️⛳🎯
