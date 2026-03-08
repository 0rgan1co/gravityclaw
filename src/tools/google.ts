import { exec } from 'child_process';
import { promisify } from 'util';
import { AgentTool } from './index.js';

const execAsync = promisify(exec);

async function runGogCommand(command: string): Promise<string> {
    try {
        // En Railway usaremos un binario descargado localmente si no existe de forma global
        const binPath = `${process.cwd()}/bin`;
        const env = {
            ...process.env,
            PATH: `${binPath}:${process.env.PATH || ''}`,
            GOG_KEYRING_PASSPHRASE: 'gravity'
        };

        const { stdout, stderr } = await execAsync(command, { env });
        if (stderr && !stdout) {
            return `Warning/Error: ${stderr}`;
        }
        return stdout || "Exito: Comando ejecutado sin salida en consola.";
    } catch (error: any) {
        return `Error ejecutando gog: ${error.message}\n${error.stderr || ''}`;
    }
}

// Gmail: Buscar correos
export const gogGmailSearchTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_gmail_search",
            description: "Busca correos en Gmail usando sintaxis normal de búsqueda de Gmail.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "La consulta o término de búsqueda (ej. 'in:inbox is:unread', 'from:pedro@gmail.com')" },
                    max: { type: "integer", description: "El número máximo de correos a traer (default 10, max 20)." }
                },
                required: ["query"],
            },
        },
    },
    execute: async (args: any) => {
        const query = (args.query || '').replace(/"/g, '\\"');
        const max = args.max || 10;
        return await runGogCommand(`gog gmail messages search "${query}" --max ${max} --account njambre.bot@gmail.com`);
    },
};

// Gmail: Enviar correo
export const gogGmailSendTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_gmail_send",
            description: "Envía un correo electrónico a uno o más destinatarios.",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string", description: "Dirección(es) de destino, separadas por coma si son varias." },
                    subject: { type: "string", description: "El asunto del correo." },
                    body: { type: "string", description: "El contenido principal del correo en texto plano." }
                },
                required: ["to", "subject", "body"],
            },
        },
    },
    execute: async (args: any) => {
        const to = args.to.replace(/"/g, '\\"');
        const subject = args.subject.replace(/"/g, '\\"');
        const bodyContent = args.body;

        // Es más confiable mandarlo usando body-file via stdin de gog
        // para soportar saltos de línea sin que rompa Bash. 
        // Generaremos el comando redirigiendo el contenido por tubería (echo/printf) al stdin de gog

        // Pero echo tiene comportamientos distintos. Haremos un string escapeado para bash:
        const safeBody = bodyContent.replace(/'/g, "'\\''");
        const command = `printf '%s' '${safeBody}' | gog gmail send --to "${to}" --subject "${subject}" --body-file - --account njambre.bot@gmail.com`;

        return await runGogCommand(command);
    },
};

// Calendar: Listar eventos
export const gogCalendarListTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_calendar_events",
            description: "Lista eventos del calendario en un rango de fechas.",
            parameters: {
                type: "object",
                properties: {
                    from: { type: "string", description: "Fecha inicio en formato ISO (ej. 2026-03-01T00:00:00Z) o fechas relativas comp 'today', 'tomorrow'" },
                    to: { type: "string", description: "Fecha fin en formato ISO o relativas (ej. 'next week', 'tomorrow')" }
                },
                required: ["from", "to"],
            },
        },
    },
    execute: async (args: any) => {
        const fromDate = args.from;
        const toDate = args.to;
        return await runGogCommand(`gog calendar events primary --from "${fromDate}" --to "${toDate}" --account njambre.bot@gmail.com`);
    },
};

// Calendar: Crear evento
export const gogCalendarCreateTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_calendar_create",
            description: "Crea un nuevo evento rápido en Google Calendar.",
            parameters: {
                type: "object",
                properties: {
                    summary: { type: "string", description: "Título o resumen del evento." },
                    from: { type: "string", description: "Fecha inicio en formato ISO o natural (e.g. '2026-03-08T15:00:00-03:00' o 'tomorrow 3pm')." },
                    to: { type: "string", description: "Fecha fin en formato ISO o natural (e.g. '2026-03-08T16:00:00-03:00' o 'tomorrow 4pm')." },
                    color: { type: "integer", description: "OPCIONAL Color ID (1-11). Ej: 1(azul claro), 4(rojo oscuro), 10(verde), 11(rojo vivo)." }
                },
                required: ["summary", "from", "to"],
            },
        },
    },
    execute: async (args: any) => {
        const summary = args.summary.replace(/"/g, '\\"');
        const colorArg = args.color ? `--event-color ${args.color}` : "";
        return await runGogCommand(`gog calendar create primary --summary "${summary}" --from "${args.from}" --to "${args.to}" ${colorArg} --account njambre.bot@gmail.com`);
    },
};

// Drive: Buscar
export const gogDriveSearchTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "gog_drive_search",
            description: "Busca archivos en Google Drive.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Terminos de busqueda (ej. title contains 'factura')" },
                    max: { type: "integer", description: "Límite máximo de resultados (Default 10)" }
                },
                required: ["query"],
            },
        },
    },
    execute: async (args: any) => {
        const query = args.query.replace(/"/g, '\\"');
        const max = args.max || 10;
        return await runGogCommand(`gog drive search "${query}" --max ${max} --account njambre.bot@gmail.com`);
    },
};
