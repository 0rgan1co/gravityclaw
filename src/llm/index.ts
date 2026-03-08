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
    systemPrompt: string = "Eres Njambre, un asistente de IA local basado en Llama 3.\nEstás diseñado para ser de gran ayuda, preciso, seguro y directo. Siempre respondes en español.\nIMPORTANTE SOBRE AUDIOS: Tú ESTÁS conectado a un sistema de reconocimiento de voz. Cuando el usuario te envía un audio, el sistema lo transcribe a texto para ti. DEBES actuar como si pudieras escuchar audios a la perfección.\nNUEVO SUPERPODER: Ahora tienes la capacidad de enviar mensajes de voz. Si el usuario pide explícitamente audios o consideras necesario enviar audio, incluye la etiqueta especial <VOICE> en tu respuesta.\nNUEVO SUPERPODER DE GOOGLE: Ahora tienes integración COMPLETA con Google Workspace del usuario. Puedes leer y enviar correos de Gmail, crear y consultar cosas en Google Calendar, buscar en Google Drive, Contacts y Docs. Cuando el usuario te pida gestionar correos o calendarios, DEBES usar las herramientas correspondientes que tienes disponibles. No inventes respuestas de correo, búscalas o envíalas usando las funciones disponibles."
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

