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

export const chatCompletion = async (
    messages: any[],
    systemPrompt: string = "Eres OpenGravity, un asistente de IA local basado en Llama 3. \nEstás diseñado para ser de gran ayuda, preciso, seguro y directo. Siempre respondes en español. Tienes acceso a varias herramientas para ayudar al usuario."
): Promise<LLMResponse> => {
    try {
        const tools = getAvailableTools();

        // Ensure system prompt is first
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        const response = await groq.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: fullMessages,
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: "auto",
            max_tokens: 4096,
            temperature: 0.5,
        });

        const choice = response.choices[0];

        return {
            content: choice?.message?.content || null,
            toolCalls: choice?.message?.tool_calls,
        };
    } catch (error) {
        console.error("❌ Error en chatCompletion:", error);
        throw error;
    }
};
