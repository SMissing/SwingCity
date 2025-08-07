#!/usr/bin/env node
// OSC Network Diagnostic Tool
// Check if tablets are reachable and can receive OSC messages

const osc = require('node-osc');
const net = require('net');

console.log('🔍 OSC Network Diagnostic Tool\n');

// Tablet configurations from the router
const tablets = {
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
    "banana": "192.168.1.142:58008"
};

async function checkTcpConnection(ip, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        const timeout = 3000; // 3 seconds
        
        socket.setTimeout(timeout);
        
        socket.connect(port, ip, () => {
            socket.destroy();
            resolve(true);
        });
        
        socket.on('error', () => {
            resolve(false);
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

async function sendTestOscMessage(ip, port, hole) {
    return new Promise((resolve) => {
        const client = new osc.Client(ip, port);
        
        client.send('/score', 42, (err) => {
            client.close();
            if (err) {
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true });
            }
        });
    });
}

async function runDiagnostics() {
    console.log('1️⃣ Testing tablet network connectivity...\n');
    
    const results = [];
    
    for (const [hole, address] of Object.entries(tablets)) {
        const [ip, port] = address.split(':');
        
        console.log(`🔍 Testing ${hole} (${address})...`);
        
        // Check TCP connectivity (basic network test)
        const tcpConnected = await checkTcpConnection(ip, parseInt(port));
        
        // Try to send OSC message
        const oscResult = await sendTestOscMessage(ip, parseInt(port), hole);
        
        const result = {
            hole,
            ip,
            port: parseInt(port),
            tcpConnected,
            oscSent: oscResult.success,
            error: oscResult.error
        };
        
        results.push(result);
        
        if (tcpConnected && oscResult.success) {
            console.log(`  ✅ Network: Connected, OSC: Sent successfully`);
        } else if (!tcpConnected) {
            console.log(`  ❌ Network: No connection to ${ip}:${port}`);
        } else {
            console.log(`  ⚠️  Network: Connected, OSC: Failed (${oscResult.error || 'unknown error'})`);
        }
        
        console.log('');
    }
    
    console.log('\n📊 SUMMARY:');
    const connected = results.filter(r => r.tcpConnected).length;
    const oscWorking = results.filter(r => r.oscSent).length;
    
    console.log(`Network connectivity: ${connected}/${results.length} tablets reachable`);
    console.log(`OSC messaging: ${oscWorking}/${results.length} tablets accepting OSC`);
    
    if (connected === 0) {
        console.log('\n🚨 NO TABLETS REACHABLE - Check network configuration!');
        console.log('Possible issues:');
        console.log('  - Tablets not powered on');
        console.log('  - Wrong IP addresses'); 
        console.log('  - Network connectivity issues');
        console.log('  - Firewall blocking connections');
    } else if (oscWorking < connected) {
        console.log('\n⚠️  SOME TABLETS NOT ACCEPTING OSC - Check tablet apps!');
        console.log('Possible issues:');
        console.log('  - Tablet apps not running');
        console.log('  - Apps listening on different ports');
        console.log('  - Apps expecting different message formats');
    } else {
        console.log('\n✅ All reachable tablets are accepting OSC messages!');
    }
}

runDiagnostics().catch(console.error);
