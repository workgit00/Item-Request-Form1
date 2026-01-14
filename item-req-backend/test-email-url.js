import dotenv from 'dotenv';
import os from 'os';

dotenv.config();

console.log('=== Email Service Configuration Test ===\n');

// Test 1: Check environment variables
console.log('1. Environment Variables:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   PORT: ${process.env.PORT}`);
console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL}`);
console.log('');

// Test 2: Get network IPs
function getNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }

    return ips;
}

console.log('2. Network IPs detected:');
const networkIPs = getNetworkIPs();
networkIPs.forEach(ip => console.log(`   - ${ip}`));
console.log('');

// Test 3: Simulate getFrontendUrl()
function getFrontendUrl() {
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
    }

    const networkIPs = getNetworkIPs();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const port = isDevelopment ? 5173 : (process.env.PORT || 3001);
    const host = networkIPs.length > 0 ? networkIPs[0] : 'localhost';

    return `http://${host}:${port}`;
}

console.log('3. Email Service URL Resolution:');
const frontendUrl = getFrontendUrl();
console.log(`   ✅ Email links will use: ${frontendUrl}`);
console.log('');

console.log('4. Sample Email Links:');
console.log(`   - Login: ${frontendUrl}/login`);
console.log(`   - Track: ${frontendUrl}/track?code=REQ-123`);
console.log(`   - Request: ${frontendUrl}/requests/456`);
console.log('');

console.log('=== Test Complete ===');
