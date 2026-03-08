import { saveMemory, deleteMemory } from '../memory/index.js';
import { buildSingleFileAppTool } from './builder.js';
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

// Registro centralizado de herramientas
const toolsRegistry: Record<string, AgentTool> = {
    get_current_time: getCurrentTimeTool,
    save_memory: saveMemoryTool,
    delete_memory: deleteMemoryTool,
    gog_gmail_search: gogGmailSearchTool,
    gog_gmail_send: gogGmailSendTool,
    gog_calendar_events: gogCalendarListTool,
    gog_calendar_create: gogCalendarCreateTool,
    gog_drive_search: gogDriveSearchTool,
    build_single_file_app: buildSingleFileAppTool,
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
