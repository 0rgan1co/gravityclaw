import { getAccessToken } from '../google-auth.js';
import { AgentTool } from './index.js';
import https from 'https';

async function googleRequest(url: string, method: string = 'GET', body: any = null): Promise<any> {
    const accessToken = await getAccessToken();
    const urlObj = new URL(url);

    return new Promise((resolve, reject) => {
        const options: any = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`Google API Error (${res.statusCode}): ${data}`));
                } else {
                    resolve(data ? JSON.parse(data) : {});
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Herramientas de Google (Versión Directa API)
export const gogGmailSearchTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_gmail_search",
            description: "Busca correos en Gmail.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    maxResults: { type: "integer" }
                },
                required: ["query"]
            }
        }
    },
    execute: async (args: any) => {
        const query = encodeURIComponent(args.query);
        const max = args.maxResults || 10;
        const data: any = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${max}`);
        if (!data.messages) return "No se encontraron mensajes.";
        const results = [];
        for (const m of data.messages) {
            const detail: any = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=minimal`);
            results.push(`- ID: ${m.id} | ${detail.snippet}`);
        }
        return results.join('\n');
    }
};

export const gogGmailSendTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_gmail_send",
            description: "Envía un correo.",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string" },
                    subject: { type: "string" },
                    body: { type: "string" }
                },
                required: ["to", "subject", "body"]
            }
        }
    },
    execute: async (args: any) => {
        const messageParts = [
            `to: ${args.to}`,
            `subject: ${args.subject}`,
            '',
            args.body
        ];
        const raw = Buffer.from(messageParts.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await googleRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', 'POST', { raw });
        return "Correo enviado.";
    }
};

export const gogCalendarListTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_calendar_events",
            description: "Lista eventos del calendario.",
            parameters: {
                type: "object",
                properties: {
                    timeMin: { type: "string" },
                    timeMax: { type: "string" }
                },
                required: ["timeMin", "timeMax"]
            }
        }
    },
    execute: async (args: any) => {
        const data: any = await googleRequest(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(args.timeMin)}&timeMax=${encodeURIComponent(args.timeMax)}&singleEvents=true&orderBy=startTime`);
        if (!data.items) return "No hay eventos.";
        return data.items.map((i: any) => `- ${i.start.dateTime || i.start.date}: ${i.summary}`).join('\n');
    }
};

export const gogCalendarCreateTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_calendar_create",
            description: "Crea un evento.",
            parameters: {
                type: "object",
                properties: {
                    summary: { type: "string" },
                    start: { type: "string" },
                    end: { type: "string" }
                },
                required: ["summary", "start", "end"]
            }
        }
    },
    execute: async (args: any) => {
        const body = {
            summary: args.summary,
            start: { dateTime: args.start },
            end: { dateTime: args.end }
        };
        const data: any = await googleRequest('https://www.googleapis.com/calendar/v3/calendars/primary/events', 'POST', body);
        return `Evento creado: ${data.htmlLink}`;
    }
};

export const gogDriveSearchTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_drive_search",
            description: "Busca en Drive.",
            parameters: {
                type: "object",
                properties: {
                    q: { type: "string" }
                },
                required: ["q"]
            }
        }
    },
    execute: async (args: any) => {
        const data: any = await googleRequest(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(args.q)}`);
        if (!data.files) return "No se encontraron archivos.";
        return data.files.map((f: any) => `- ${f.name} (${f.id})`).join('\n');
    }
};
