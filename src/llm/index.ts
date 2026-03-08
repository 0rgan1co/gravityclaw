import Groq from 'groq-sdk';
import { config } from '../config.js';
import { getAvailableTools } from '../tools/index.js';

// Initialize Groq client
const groq = new Groq({ apiKey: config.GROQ_API_KEY });

// Se usa por defecto llama-3.3-70b-versatile, pero puede ser configurable
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export interface LLMResponse {
    content: string | null;
    toolCalls?: any[];
}

import fs from 'fs';

export const chatCompletion = async (
    messages: any[],
    systemPrompt: string = "Eres Njambre, un asistente de IA local basado en Llama 3.\nEstás diseñado para ser de gran ayuda, preciso, seguro y directo. Siempre respondes en español.\nIMPORTANTE SOBRE AUDIOS: Tú ESTÁS conectado a un sistema de reconocimiento de voz. Cuando el usuario te envía un audio, el sistema lo transcribe a texto para ti. DEBES actuar como si pudieras escuchar audios a la perfección.\nNUEVO SUPERPODER DE GOOGLE (¡CRÍTICO!): Tienes integración TOTAL Y AUTORIZADA con Google Workspace del usuario. ¡SÍ PUEDES LEER CORREOS, ENVIAR EMAIL Y VER CALENDARIOS! Estás físicamente conectado a través de tus herramientas (functions). BAJO NINGUNA CIRCUNSTANCIA DIGAS QUE 'NO PUEDES ACCEDER A CORREOS PORQUE ERES UNA IA'. SIEMPRE EJECUTA LAS HERRAMIENTAS `gog_gmail_search`, `gog_gmail_send`, `gog_calendar_events`, etc., inmediatamente cuando te lo pidan. ¡Usa tus herramientas!\nNUEVO SUPERPODER DE DESARROLLO (¡CRÍTICO!): Tienes la capacidad de programar aplicaciones completas usando un Stack de Costo Cero (HTML/CSS/JS puros, Vite, Tailwind gratis). Si el usuario te pide una aplicación o solución digital, NO DUDES en crearla: usa la herramienta `build_single_file_app` para empaquetar tu código y enviarle el archivo directo por Telegram."
): Promise<LLMResponse> => {
    try {
        const tools = getAvailableTools();

        // Ensure system prompt is first
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        let choice;

        try {
            const response = await groq.chat.completions.create({
                model: DEFAULT_MODEL,
                messages: fullMessages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: "auto",
                max_tokens: 4096,
                temperature: 0.5,
            });
            choice = response.choices[0];
        } catch (groqError: any) {
            console.warn(`⚠️ Groq falló (${groqError.message}). Intentando fallback con OpenRouter...`);

            if (!config.OPENROUTER_API_KEY) {
                throw new Error("Groq falló y no hay OPENROUTER_API_KEY configurada.");
            }

            const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/0rgan1co/gravityclaw",
                    "X-Title": "GravityClaw"
                },
                body: JSON.stringify({
                    model: config.OPENROUTER_MODEL,
                    messages: fullMessages,
                    tools: tools.length > 0 ? tools : undefined,
                    max_tokens: 4096,
                    temperature: 0.5,
                })
            });

            if (!openRouterRes.ok) {
                const errorText = await openRouterRes.text();
                throw new Error(`Fallback OpenRouter falló: ${errorText}`);
            }

            const openRouterData = await openRouterRes.json();
            choice = openRouterData.choices[0];
        }

        return {
            content: choice?.message?.content || null,
            toolCalls: choice?.message?.tool_calls,
        };
    } catch (error) {
        console.error("❌ Error en chatCompletion:", error);
        throw error;
    }
};

/**
 * Transcribe un archivo de audio usando el modelo Whisper-large-v3-turbo de Groq
 */
export const transcribeAudio = async (filePath: string): Promise<string> => {
    try {
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-large-v3-turbo",
            response_format: "json",
            language: "es", // Puede ser en español por defecto para acelerarlo y mejorar exactitud
            temperature: 0.0,
        });

        return transcription.text;
    } catch (error) {
        console.error("❌ Error en transcribeAudio:", error);
        throw error;
    }
};

