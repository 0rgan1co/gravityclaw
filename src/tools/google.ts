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
            description: "Busca correos electrónicos en la cuenta de Gmail del usuario. Úsala para leer mensajes recientes, buscar facturas, planes o cualquier información comunicada por email.",
            parameters: {
                type: "object",
                properties: {
                    query: { 
                        type: "string", 
                        description: "Consulta de búsqueda con formato de Gmail (ej. 'from:boss@company.com', 'subject:reunión', 'newer_than:1d')." 
                    },
                    maxResults: { 
                        type: "integer", 
                        description: "Número máximo de correos a recuperar (por defecto 5)." 
                    }
                },
                required: ["query"]
            }
        }
    },
    execute: async (args: any) => {
        const query = encodeURIComponent(args.query);
        const max = args.maxResults || 5;
        const data: any = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${max}`);
        if (!data.messages) return "No se encontraron mensajes que coincidan con la búsqueda.";
        const results = [];
        for (const m of data.messages) {
            const detail: any = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=minimal`);
            const snippet = detail.snippet || "Sin vista previa";
            results.push(`- [ID: ${m.id}] ${snippet}`);
        }
        return `Resultados de búsqueda en Gmail:\n${results.join('\n')}\n\nUsa gog_gmail_get_message con el ID para ver el contenido completo de un correo si es necesario.`;
    }
};

export const gogGmailSendTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_gmail_send",
            description: "Envía un nuevo correo electrónico desde la cuenta del usuario.",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string", description: "Email del destinatario." },
                    subject: { type: "string", description: "Asunto del correo." },
                    body: { type: "string", description: "Contenido del mensaje (puedes usar texto plano)." }
                },
                required: ["to", "subject", "body"]
            }
        }
    },
    execute: async (args: any) => {
        const messageParts = [
            `Content-Type: text/plain; charset="UTF-8"`,
            `MIME-Version: 1.0`,
            `To: ${args.to}`,
            `Subject: ${args.subject}`,
            '',
            args.body
        ];
        const raw = Buffer.from(messageParts.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await googleRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', 'POST', { raw });
        return `✅ Correo enviado con éxito a ${args.to} con el asunto "${args.subject}"`;
    }
};

export const gogGmailGetMessageTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_gmail_get_message",
            description: "Obtiene el contenido completo de un correo específico por su ID.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "El ID del mensaje de Gmail." }
                },
                required: ["id"]
            }
        }
    },
    execute: async (args: any) => {
        const detail: any = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${args.id}`);
        // Gmail API returns the body in a complex structure (payload.parts or payload.body)
        let content = detail.snippet;
        if (detail.payload && detail.payload.parts) {
            const bodyPart = detail.payload.parts.find((p: any) => p.mimeType === 'text/plain') || detail.payload.parts[0];
            if (bodyPart && bodyPart.body && bodyPart.body.data) {
                content = Buffer.from(bodyPart.body.data, 'base64').toString('utf-8');
            }
        } else if (detail.payload && detail.payload.body && detail.payload.body.data) {
            content = Buffer.from(detail.payload.body.data, 'base64').toString('utf-8');
        }
        
        const from = detail.payload.headers.find((h: any) => h.name === 'From')?.value;
        const subject = detail.payload.headers.find((h: any) => h.name === 'Subject')?.value;
        
        return `CONTENIDO DEL CORREO:\nDe: ${from}\nAsunto: ${subject}\n\nCuerpo:\n${content}`;
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
