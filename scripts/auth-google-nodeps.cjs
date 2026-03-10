const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000';
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Faltan GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en las variables de entorno.');
    process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(SCOPES)}&` +
    `access_type=offline&` +
    `prompt=consent`;

console.log('\n🚀 Autorización de Google (Sin dependencias)');
console.log('1. Abre este enlace en tu navegador:\n', authUrl);
console.log('\n2. Después de autorizar, serás redirigido a una página que NO carga (error en localhost:3000).');
console.log('3. COPIA EL CÓDIGO que aparece en la URL del navegador después de "code="');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question('\n4. Pega el código completo aquí: ', (input) => {
    rl.close();

    let code = input;
    if (input.includes('code=')) {
        try {
            const urlObj = new URL(input);
            code = urlObj.searchParams.get('code') || input;
        } catch (e) {
            // Fallback manual si URL falla
            const match = input.match(/code=([^&]+)/);
            if (match) code = match[1];
        }
    }

    const postData = `code=${code}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&grant_type=authorization_code`;

    const req = https.request({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    }, (res) => {
        let responseBody = '';
        res.on('data', (d) => responseBody += d);
        res.on('end', () => {
            try {
                const tokens = JSON.parse(responseBody);
                if (tokens.error) {
                    console.error('\n❌ Error:', tokens.error_description || tokens.error);
                    return;
                }
                fs.writeFileSync(path.join(process.cwd(), 'google-token.json'), JSON.stringify(tokens, null, 2));
                console.log('\n✅ ¡Token guardado exitosamente en google-token.json!');
                console.log('Ahora el agente tiene acceso a Google Workspace en este proyecto.');
            } catch (e) {
                console.error('\n❌ Error parseando respuesta:', responseBody);
            }
        });
    });

    req.on('error', (e) => console.error('\n❌ Error de red:', e));
    req.write(postData);
    req.end();
});
