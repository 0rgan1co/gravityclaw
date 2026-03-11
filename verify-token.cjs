const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN_PATH = path.join(process.cwd(), 'google-token.json');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

async function makeRequest(url, token) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function refreshToken(refresh_token) {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env to perform refresh.");
    }
    const postData = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${refresh_token}&grant_type=refresh_token`;
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': postData.length
            }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                const data = JSON.parse(body);
                if (data.access_token) {
                    resolve(data);
                } else {
                    reject(new Error("Refresh failed: " + (data.error_description || data.error)));
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function verify() {
    console.log("--- 🚀 OpenGravity Google API Diagnostics & Repair ---");
    
    if (!fs.existsSync(TOKEN_PATH)) {
        console.error("❌ google-token.json not found!");
        return;
    }

    let tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    let accessToken = tokens.access_token;

    console.log("\n1. Testing Current Access Token...");
    const testUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1`;
    let res = await makeRequest(testUrl, accessToken);

    if (res.statusCode === 401) {
        console.log("⚠️ Access token expired (401). Attempting automatic refresh...");
        if (tokens.refresh_token) {
            try {
                const newTokens = await refreshToken(tokens.refresh_token);
                tokens = { ...tokens, ...newTokens };
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
                accessToken = tokens.access_token;
                console.log("✅ Token refreshed successfully and saved to google-token.json!");
                // Retry test
                res = await makeRequest(testUrl, accessToken);
            } catch (e) {
                console.error("❌ Refresh failed:", e.message);
                console.log("👉 Recommendation: Run the auth script again to get a new token.");
                return;
            }
        } else {
            console.error("❌ No refresh_token found in google-token.json. Cannot refresh.");
            return;
        }
    }

    if (res.statusCode === 200) {
        console.log("✅ Google APIs: AUTHORIZED");
        
        console.log("\n2. Checking Service Permissions...");
        // Test Gmail
        const gmailRes = await makeRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1`, accessToken);
        if (gmailRes.statusCode === 200) {
            console.log("   ✅ Gmail: ACCESSIBLE");
        } else {
            console.log(`   ❌ Gmail: ACCESS DENIED (${gmailRes.statusCode})`);
            if (gmailRes.statusCode === 403) console.log("      (Check if Gmail API is enabled in Cloud Console and scopes are in token)");
        }

        // Test Calendar
        const calRes = await makeRequest(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1`, accessToken);
        if (calRes.statusCode === 200) {
            console.log("   ✅ Calendar: ACCESSIBLE");
        } else {
            console.log(`   ❌ Calendar: ACCESS DENIED (${calRes.statusCode})`);
        }
    } else {
        console.error(`❌ Authorization failed: (${res.statusCode}) - ${res.data}`);
    }

    console.log("\n--- Final Status ---");
    if (res.statusCode === 200) {
        console.log("🚀 All systems ready. If this is local, copy your google-token.json content to the GOOGLE_TOKEN_JSON environment variable in Railway.");
    }
}

verify();
