import fs from 'fs';
import path from 'path';
import https from 'https';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const TOKEN_PATH = path.join(process.cwd(), 'google-token.json');

export async function getAccessToken() {
    if (!fs.existsSync(TOKEN_PATH)) {
        throw new Error("No hay tokens de Google. Ejecuta 'node scripts/auth-google-nodeps.cjs' primero.");
    }

    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));

    // Si el token ha expirado (o parece que va a expirar), lo refrescamos
    if (tokens.refresh_token) {
        return refreshAccessToken(tokens.refresh_token);
    }

    return tokens.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
    const postData = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${refreshToken}&grant_type=refresh_token`;

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
                    const currentTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
                    fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...currentTokens, ...data }, null, 2));
                    resolve(data.access_token);
                } else {
                    reject(new Error("Error refrescando token: " + (data.error_description || data.error)));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}
