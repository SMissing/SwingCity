// Minimal OSC Router for SwingCity V2
const osc = require('node-osc');
const EventEmitter = require('events');

class OSCRouter extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.messageLog = [];
    this.isRunning = false;
  }

  start(port = 57121) {
    if (this.isRunning) {
      console.log('🎵 OSC Router already running');
      return;
    }
    this.server = new osc.Server(port, '0.0.0.0');
    this.server.on('message', (msg, rinfo) => this._onMessage(msg, rinfo));
    this.server.on('listening', () => {
      this.isRunning = true;
      console.log(`🎵 OSC Router listening on port ${port}`);
    });
    this.server.on('error', (err) => {
      this.isRunning = false;
      console.error('❌ OSC Router error:', err);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.isRunning = false;
      console.log('🎵 OSC Router stopped');
    }
  }

  _onMessage(msg, rinfo) {
    const [address, ...args] = msg;
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'received',
      address,
      args,
      source: `${rinfo.address}:${rinfo.port}`,
      status: 'processing'
    };
    console.log(`⚡️ OSC Received: ${address} args=${JSON.stringify(args)} from ${rinfo.address}:${rinfo.port}`);

    // Parse address: /hole/score
    const parts = address.replace(/^\/+/,'').split('/');
    if (parts.length !== 2 || parts[1] !== 'score') {
      logEntry.status = 'error';
      logEntry.error = 'Wrong format, expected /[hole]/score';
      this._addLogEntry(logEntry);
      return;
    }
    const holeName = parts[0].toLowerCase();
    logEntry.holeName = holeName;
    if (!args || args.length === 0) {
      logEntry.status = 'error';
      logEntry.error = 'No score arguments';
      this._addLogEntry(logEntry);
      return;
    }

    // Emit event for server/tablet update
    this.emit('osc-score', { hole: holeName, score: args[0], raw: msg, source: rinfo });
    logEntry.status = 'received';
    logEntry.message = `OSC score received for ${holeName}: ${args[0]}`;
    this._addLogEntry(logEntry);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      connectedClients: 0,
      routingEntries: 0
    };
  }

  // getRoutingTable removed; not needed for minimal router

  _addLogEntry(entry) {
    this.messageLog.unshift(entry);
    if (this.messageLog.length > 100) {
      this.messageLog = this.messageLog.slice(0, 100);
    }
    this.emit('message', entry);
  }

  getMessageLog() {
    return [...this.messageLog];
  }

  clearMessageLog() {
    this.messageLog = [];
    this.emit('logCleared');
  }
}

module.exports = OSCRouter;
