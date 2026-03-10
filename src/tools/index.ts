import { saveMemory, deleteMemory, getRelevantMemories } from '../memory/index.js';
import { buildSingleFileAppTool } from './builder.js';
import { githubTools, executeGitHubCommands } from './github.js';
import {
    gogGmailSearchTool,
    gogGmailSendTool,
    gogCalendarListTool,
    gogCalendarCreateTool,
    gogDriveSearchTool
} from './google.js';

interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

export interface AgentTool {
    definition: ToolDefinition;
    execute: (args?: any) => Promise<string> | string;
}

// Implementación de la herramienta get_current_time
const getCurrentTimeTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "get_current_time",
            description: "Obtiene la fecha y hora actual",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    execute: () => {
        return new Date().toISOString();
    },
};

// Tool: Guardar memoria a largo plazo
const saveMemoryTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "save_memory",
            description: "Guarda una nueva memoria para el usuario. Úsala para almacenar información importante que debemos recordar para futuras interacciones.",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "integer", description: "El ID del usuario (debes tenerlo en tu contexto)" },
                    conversation_id: { type: "string", description: "El ID de la conversación actual, si existe." },
                    type: { type: "string", description: "El tipo de memoria (ej. 'preference', 'fact', 'goal')" },
                    content: { type: "string", description: "El contenido de lo que se debe recordar" }
                },
                required: ["user_id", "type", "content"],
            },
        },
    },
    execute: (args?: any) => {
        saveMemory(args.user_id, args.type, args.content, args.conversation_id);
        return `Memoria agregada exitosamente de tipo: ${args.type}`;
    },
};

// Tool: Eliminar memoria a largo plazo
const deleteMemoryTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "delete_memory",
            description: "Borra una memoria por su ID literal.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "integer", description: "El ID de la memoria a borrar" }
                },
                required: ["id"],
            },
        },
    },
    execute: (args?: any) => {
        deleteMemory(args.id);
        return `Memoria ${args.id} eliminada exitosamente.`;
    },
};

// Tool: Recuperar memorias adicionales
const recallMemoryTool: AgentTool = {
    definition: {
        type: "function",
        function: {
            name: "recall_memory",
            description: "Recupera memorias guardadas sobre un tema específico. Úsala si necesitas recordar detalles sobre algo que el usuario mencionó anteriormente y que no está en el historial reciente.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Término o tema para buscar en las memorias (ej. 'preferencias de café', 'datos de la empresa')" }
                },
                required: ["query"],
            },
        },
    },
    execute: (args?: any) => {
        // En esta versión simple, buscamos las últimas memorias.
        const memories = getRelevantMemories(args.userId || 0, 10);
        if (memories.length === 0) return "No se encontraron memorias relacionadas.";
        return memories.map(m => `- [${m.type}] ${m.content}`).join('\n');
    },
};


// GitHub CLI wrapper
const githubCliTool: AgentTool = {
    definition: githubTools[0] as ToolDefinition,
    // execute assumes args is an object containing `arguments` string. We pass it properly to the underlying github commands file.
    execute: (args?: any) => executeGitHubCommands("execute_github_cli", args)
};

// Registro centralizado de herramientas
const toolsRegistry: Record<string, AgentTool> = {
    get_current_time: getCurrentTimeTool,
    save_memory: saveMemoryTool,
    delete_memory: deleteMemoryTool,
    recall_memory: recallMemoryTool,
    gog_gmail_search: gogGmailSearchTool,
    gog_gmail_send: gogGmailSendTool,
    gog_calendar_events: gogCalendarListTool,
    gog_calendar_create: gogCalendarCreateTool,
    gog_drive_search: gogDriveSearchTool,
    build_single_file_app: buildSingleFileAppTool,
    execute_github_cli: githubCliTool,
};


/**
 * Obtiene la definición de todas las herramientas registradas en el formato que Groq/OpenAI espera.
 */
export const getAvailableTools = (): ToolDefinition[] => {
    return Object.values(toolsRegistry).map(tool => tool.definition);
};

/**
 * Ejecuta una herramienta por su nombre y parseando sus argumentos.
 */
export const executeTool = async (name: string, functionArgs: string): Promise<string> => {
    const tool = toolsRegistry[name];
    if (!tool) {
        return `Error: Unknown tool ${name}`;
    }

    try {
        const args = functionArgs ? JSON.parse(functionArgs) : {};
        const result = await tool.execute(args);
        return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (err: any) {
        return `Error executing tool: ${err?.message || String(err)}`;
    }
};
