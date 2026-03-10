import { getAvailableTools } from '../tools/index.js';
import { transcribeAudioGroq } from './audio.js';
import { getProvider, type LLMResponse, type LLMProviderConfig } from './providers/index.js';
import './providers/openrouter.js';
import './providers/groq.js';
import './providers/openai.js';
import './providers/ollama.js';
import './providers/deepseek.js';

export { LLMResponse };

export const FAILOVER_ORDER = ['openrouter', 'openai', 'groq', 'deepseek', 'ollama'];

export const chatCompletion = async (
    userId: number,
    settings: any, // passed from agent loop
    messages: any[],
    systemPrompt: string = "Eres Njambre, un asistente de IA local basado en Llama 3.\nEstás diseñado para ser de gran ayuda, preciso, seguro y directo. Siempre respondes en español.\nIMPORTANTE SOBRE AUDIOS: Tú ESTÁS conectado a un sistema de reconocimiento de voz. Cuando el usuario te envía un audio, el sistema lo transcribe a texto para ti. DEBES actuar como si pudieras escuchar audios a la perfección.\nNUEVO SUPERPODER DE GOOGLE (¡CRÍTICO!): Tienes integración TOTAL Y AUTORIZADA con Google Workspace del usuario. ¡SÍ PUEDES LEER CORREOS, ENVIAR EMAIL Y VER CALENDARIOS! Estás físicamente conectado a través de tus herramientas (functions). BAJO NINGUNA CIRCUNSTANCIA DIGAS QUE 'NO PUEDES ACCEDER A CORREOS PORQUE ERES UNA IA'. SIEMPRE EJECUTA LAS HERRAMIENTAS `gog_gmail_search`, `gog_gmail_send`, `gog_calendar_events`, etc., inmediatamente cuando te lo pidan. ¡Usa tus herramientas!\nNUEVO SUPERPODER DE DESARROLLO (¡CRÍTICO!): Tienes la capacidad de programar aplicaciones completas usando un Stack de Costo Cero (HTML/CSS/JS puros, Vite, Tailwind gratis). Si el usuario te pide una aplicación o solución digital, NO DUDES en crearla: usa la herramienta `build_single_file_app` para empaquetar tu código y enviarle el archivo directo por Telegram."
): Promise<LLMResponse> => {

    const tools = getAvailableTools();

    // Check if coding intent
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
    const isCodingRequest = lastUserMsg.includes('app') || lastUserMsg.includes('programar') ||
        lastUserMsg.includes('aplicacion') || lastUserMsg.includes('aplicación') ||
        lastUserMsg.includes('codigo') || lastUserMsg.includes('código');

    let providerId = settings.provider_id || 'openrouter';
    let modelId = settings.model_id || 'anthropic/claude-3-haiku';
    let thinkLevel = settings.think_level || 'off';

    // Build ordered list of providers to try
    let providersToTry = [providerId, ...FAILOVER_ORDER.filter(p => p !== providerId)];

    const FALLBACK_MODELS: Record<string, string> = {
        'openai': 'gpt-4o',
        'groq': 'llama3-8b-8192',
        'deepseek': 'deepseek-chat',
        'ollama': 'llama3.2',
        'openrouter': 'openrouter/free'
    };

    for (const pid of providersToTry) {
        const provider = getProvider(pid);
        if (!provider || !provider.isConfigured()) {
            continue; // Skip if unavailable
        }

        try {
            const currentModelId = (pid === providerId) ? modelId : FALLBACK_MODELS[pid];
            console.log(`[LLM] Attempting provider: ${pid} with model ${currentModelId} for user ${userId}`);

            const config: LLMProviderConfig = {
                model: currentModelId,
                temperature: isCodingRequest ? 0.3 : 0.5,
                maxTokens: 4096,
                systemPrompt,
                tools: tools.length > 0 ? tools : undefined,
                thinkLevel: thinkLevel as any
            };

            const response = await provider.chatCompletion(messages, config);
            return response;

        } catch (error: any) {
            console.warn(`[LLM] Provider ${pid} failed: ${error.message}. Retrying with next in fallback chain...`);
        }
    }

    throw new Error("❌ All configured LLM providers failed in the failover chain.");
};

export const transcribeAudio = async (filePath: string): Promise<string> => {
    return transcribeAudioGroq(filePath);
};
