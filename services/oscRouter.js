// services/oscRouter.js
// OSC (Open Sound Control) Router Service
// Integrated OSC routing functionality for SwingCity V2

const osc = require('node-osc');
const EventEmitter = require('events');

class OSCRouter extends EventEmitter {
    constructor() {
        super();
        this.server = null;
        this.clients = new Map(); // Cache OSC clients for reuse
        this.mastermindData = { float: null, string: null }; // Special handling for mastermind
        this.messageLog = []; // Store recent messages for web interface
        
        // ROUTING TABLE - Maps hole names to destination IP addresses
        this.holeToAddr = {
            "plinko": "192.168.1.222:58008",
            "spinningtop": "192.168.1.215:58008",
            "haphazard": "192.168.1.159:58008",
            "roundhouse": "192.168.1.143:58008",
            "hillhop": "192.168.1.138:58008",
            "skijump": "192.168.1.184:58008",
            "mastermind": "192.168.1.211:58008",
            "hole8": "192.168.1.196:58008",
            "octogon": "192.168.1.221:58008",
            "loopdeloop": "192.168.1.194:58008",
            "upandover": "192.168.1.249:58008",
            "banana": "192.168.1.142:58008",
        };
        
        this.defaultPort = 58008;
        this.isRunning = false;
    }

    /**
     * Start the OSC router server
     * @param {number} port - Port to listen on (default: 57121)
     */
    start(port = 57121) {
        if (this.isRunning) {
            console.log('🎵 OSC Router is already running');
            return;
        }

        try {
            this.server = new osc.Server(port, '0.0.0.0');
            
            // Handle incoming OSC messages
            this.server.on('message', (msg, rinfo) => {
                this.handleMessage(msg, rinfo);
            });

            this.server.on('listening', () => {
                console.log(`🎵 OSC Router listening on port ${port}`);
                this.isRunning = true;
            });

            this.server.on('error', (err) => {
                console.error('❌ OSC Router error:', err);
                this.isRunning = false;
            });

        } catch (error) {
            console.error('❌ Failed to start OSC Router:', error);
            throw error;
        }
    }

    /**
     * Stop the OSC router server
     */
    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.isRunning = false;
            console.log('🎵 OSC Router stopped');
        }
        
        // Close all client connections
        for (const [key, client] of this.clients) {
            try {
                client.close();
            } catch (err) {
                // Ignore close errors
            }
        }
        this.clients.clear();
    }

    /**
     * Handle incoming OSC messages
     * @param {Array} msg - OSC message [address, ...args]
     * @param {Object} rinfo - Remote info (IP, port, etc.)
     */
    handleMessage(msg, rinfo) {
        const [address, ...args] = msg;
        const timestamp = new Date().toISOString();
        
        // Create log entry for web interface
        const logEntry = {
            timestamp,
            type: 'received',
            address,
            args,
            source: `${rinfo.address}:${rinfo.port}`,
            status: 'processing'
        };
        
        console.log(`⚡️ Got OSC → ${address} args=${JSON.stringify(args)} from ${rinfo.address}:${rinfo.port}`);
        
        // Parse the OSC address to extract hole name and command
        const parts = address.replace(/^\/+/, '').split('/'); // Remove leading slashes and split
        
        // Expecting format: ["hole_name", "score"] (e.g., ["plinko", "score"])
        if (parts.length !== 2 || parts[1] !== 'score') {
            console.log('  ⚠️  Wrong format, expected /[hole]/score, skipping.');
            logEntry.status = 'error';
            logEntry.error = 'Wrong format, expected /[hole]/score';
            this.addLogEntry(logEntry);
            return;
        }

        const holeName = parts[0].toLowerCase(); // Normalize to lowercase
        const destinationAddr = this.holeToAddr[holeName];
        
        console.log(`  ▶  Hole: ${holeName} → mapped addr: ${destinationAddr}`);
        
        // Check if we have a mapping for this hole name
        if (!destinationAddr) {
            console.log(`  ⚠️  No mapping for '${holeName}' → skipping.`);
            logEntry.status = 'error';
            logEntry.error = `No mapping for '${holeName}'`;
            this.addLogEntry(logEntry);
            return;
        }

        logEntry.holeName = holeName;
        logEntry.destination = destinationAddr;

        // Validate arguments
        if (!args || args.length === 0) {
            console.log('  ⚠️  No score args, skipping.');
            logEntry.status = 'error';
            logEntry.error = 'No score arguments';
            this.addLogEntry(logEntry);
            return;
        }

        // Parse destination address
        const { ip, port } = this.parseAddress(destinationAddr);
        if (!ip || !port) {
            console.log(`  ⚠️  Invalid destination address: ${destinationAddr}`);
            logEntry.status = 'error';
            logEntry.error = `Invalid destination address: ${destinationAddr}`;
            this.addLogEntry(logEntry);
            return;
        }

        // Handle different hole types
        if (holeName === 'mastermind') {
            this.handleMastermindMessage(args, ip, port, logEntry);
        } else {
            this.handleStandardMessage(args, ip, port, logEntry);
        }
    }

    /**
     * Handle standard hole messages (single float score)
     */
    handleStandardMessage(args, ip, port, logEntry) {
        const scoreValue = args[0]; // Take first argument (should be float score)
        
        try {
            this.sendOSCMessage(ip, port, '/score', [scoreValue]);
            console.log(`  ✅  Forwarded → /score ${scoreValue} to ${ip}:${port}`);
            
            // Log successful forwarding
            logEntry.status = 'forwarded';
            logEntry.forwardedTo = `${ip}:${port}`;
            logEntry.forwardedMessage = '/score';
            logEntry.forwardedArgs = [scoreValue];
            this.addLogEntry(logEntry);
            
        } catch (error) {
            console.error(`  ❌  Error sending to ${ip}:${port} — ${error.message}`);
            logEntry.status = 'error';
            logEntry.error = `Error sending to ${ip}:${port} - ${error.message}`;
            this.addLogEntry(logEntry);
        }
    }

    /**
     * Handle mastermind messages (needs both float and string)
     */
    handleMastermindMessage(args, ip, port, logEntry) {
        const value = args[0];
        
        // Store the incoming value based on its type
        if (typeof value === 'number') {
            this.mastermindData.float = value;
            console.log(`  📊  Stored float: ${this.mastermindData.float}`);
            logEntry.status = 'waiting';
            logEntry.message = `Stored float: ${value}, waiting for string`;
        } else if (typeof value === 'string') {
            this.mastermindData.string = value;
            console.log(`  📝  Stored string: ${this.mastermindData.string}`);
            logEntry.status = 'waiting';
            logEntry.message = `Stored string: ${value}, waiting for float`;
        }
        
        // Check if we have both values to send
        if (this.mastermindData.float !== null && this.mastermindData.string !== null) {
            try {
                const values = [this.mastermindData.float, this.mastermindData.string];
                this.sendOSCMessage(ip, port, '/score', values);
                console.log(`  ✅  Forwarded → /score ${JSON.stringify(values)} to ${ip}:${port}`);
                
                // Log successful forwarding
                logEntry.status = 'forwarded';
                logEntry.forwardedTo = `${ip}:${port}`;
                logEntry.forwardedMessage = '/score';
                logEntry.forwardedArgs = values;
                logEntry.message = `Combined mastermind data sent`;
                
                // Reset for next round
                this.mastermindData.float = null;
                this.mastermindData.string = null;
                
            } catch (error) {
                console.error(`  ❌  Error sending to ${ip}:${port} — ${error.message}`);
                logEntry.status = 'error';
                logEntry.error = `Error sending to ${ip}:${port} - ${error.message}`;
            }
        } else {
            console.log(`  ⏳  Waiting for more data... float=${this.mastermindData.float}, string=${this.mastermindData.string}`);
        }
        
        this.addLogEntry(logEntry);
    }

    /**
     * Send OSC message to destination
     */
    sendOSCMessage(ip, port, address, args) {
        const clientKey = `${ip}:${port}`;
        
        // Get or create client
        if (!this.clients.has(clientKey)) {
            const client = new osc.Client(ip, port);
            this.clients.set(clientKey, client);
        }
        
        const client = this.clients.get(clientKey);
        client.send(address, ...args);
    }

    /**
     * Parse address string into IP and port
     */
    parseAddress(addr) {
        if (addr.includes(':')) {
            const [ip, portStr] = addr.split(':', 2);
            const port = parseInt(portStr, 10);
            if (isNaN(port)) {
                return { ip: null, port: null };
            }
            return { ip, port };
        } else {
            return { ip: addr, port: this.defaultPort };
        }
    }

    /**
     * Update routing table
     */
    updateRouting(holeName, address) {
        this.holeToAddr[holeName.toLowerCase()] = address;
        console.log(`🎵 Updated routing: ${holeName} → ${address}`);
    }

    /**
     * Get current routing table
     */
    getRoutingTable() {
        return { ...this.holeToAddr };
    }

    /**
     * Get status information
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            connectedClients: this.clients.size,
            routingEntries: Object.keys(this.holeToAddr).length,
            mastermindData: { ...this.mastermindData }
        };
    }

    /**
     * Add log entry and emit event for web interface
     */
    addLogEntry(entry) {
        // Add to message log (keep last 100 messages)
        this.messageLog.unshift(entry);
        if (this.messageLog.length > 100) {
            this.messageLog = this.messageLog.slice(0, 100);
        }
        
        // Emit event for real-time updates
        this.emit('message', entry);
    }

    /**
     * Get recent message log
     */
    getMessageLog() {
        return [...this.messageLog];
    }

    /**
     * Clear message log
     */
    clearMessageLog() {
        this.messageLog = [];
        this.emit('logCleared');
    }
}

module.exports = OSCRouter;
