#!/usr/bin/env node

const os = require('os');

console.log('🌍 Mercury Performance Tools - Network Information');
console.log('==================================================\n');

const networkInterfaces = os.networkInterfaces();
const port = process.env.PORT || 3000;

console.log(`📡 Server will run on port: ${port}\n`);

console.log('🌐 Available Network Interfaces:');
console.log('--------------------------------');

Object.keys(networkInterfaces).forEach((interfaceName) => {
    const interfaces = networkInterfaces[interfaceName];
    interfaces.forEach((iface) => {
        if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`   ${interfaceName}:`);
            console.log(`     IP: ${iface.address}`);
            console.log(`     URL: http://${iface.address}:${port}`);
            console.log(`     Netmask: ${iface.netmask}`);
            console.log('');
        }
    });
});

console.log('🔗 Local Access URLs:');
console.log('--------------------');
console.log(`   Localhost: http://localhost:${port}`);
console.log(`   127.0.0.1: http://127.0.0.1:${port}`);
console.log('');

console.log('📋 Usage Instructions:');
console.log('---------------------');
console.log('1. Start the server with: npm run network');
console.log('2. Other devices on the same network can access using any of the IP addresses above');
console.log('3. Make sure your firewall allows connections on port ' + port);
console.log('');

console.log('🔒 Security Notes:');
console.log('-----------------');
console.log('- The server will be accessible to all devices on the same network');
console.log('- Use firewall rules to restrict access if needed');
console.log('- Consider using HTTPS in production environments');
console.log(''); 