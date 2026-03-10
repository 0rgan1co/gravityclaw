import { Bot, InputFile } from 'grammy';
import fs from 'fs';
import { config } from '../config.js';
import { processUserMessage } from '../agent/index.js';
import { clearUserHistory, updateUserSettings } from '../memory/index.js';
import {
    transcribeVoiceMessage,
    generateSpeechifyAudio,
    isTalkModeOn,
    toggleTalkMode,
} from '../voice/index.js';

export const setupBot = () => {
    const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

    // Middleware de Whitelist: Solo permitir a los usuarios autorizados
    bot.use(async (ctx, next) => {
        if (!ctx.from) return;

        if (!config.TELEGRAM_ALLOWED_USER_IDS.includes(ctx.from.id)) {
            console.log(`[Bot] Acceso denegado al usuario ID: ${ctx.from.id} (${ctx.from.username})`);
            return;
        }
        await next();
    });

    // Comando /start
    bot.command('start', (ctx) => {
        ctx.reply('Hola. Soy OpenGravity, tu agente personal e interfaz inteligente. Estoy listo para ayudarte. Usa /clear para reiniciar tu memoria y /talk para activar el modo conversación por voz.');
    });

    bot.command('clear', async (ctx) => {
        if (ctx.from) {
            await clearUserHistory(ctx.from.id);
            ctx.reply('Memoria borrada. Hemos empezado una nueva conversación.');
        }
    });

    bot.command('model', async (ctx) => {
        if (!ctx.from) return;
        const args = ctx.match.split(' ');
        if (args.length < 2) {
            return ctx.reply('Uso: /model <provider> <model_id>\nEjemplo: /model openrouter anthropic/claude-3-haiku\nProviders disponibles: openrouter, openai, groq, ollama, deepseek');
        }

        const providerId = args[0].toLowerCase();
        const modelId = args[1];

        updateUserSettings(ctx.from.id, { provider_id: providerId, model_id: modelId });
        ctx.reply(`✅ Modelo actualizado: Proveedor **${providerId}** con el modelo **${modelId}**`, { parse_mode: 'Markdown' });
    });

    bot.command('think', async (ctx) => {
        if (!ctx.from) return;
        const level = ctx.match.toLowerCase() as any;
        if (!['off', 'low', 'medium', 'high'].includes(level)) {
            return ctx.reply('Uso: /think <off|low|medium|high>\nEjemplo: /think medium');
        }

        updateUserSettings(ctx.from.id, { think_level: level });
        ctx.reply(`✅ Nivel de pensamiento iterativo seteado a: **${level}**`, { parse_mode: 'Markdown' });
    });

    // Comando /talk — Activa/desactiva el Talk Mode (respuestas siempre en audio)
    bot.command('talk', async (ctx) => {
        if (!ctx.from) return;

        const isOn = toggleTalkMode(ctx.from.id);
        if (isOn) {
            await ctx.reply('🎙️ Talk Mode ACTIVADO. Todas mis respuestas incluirán audio. Usa /talk de nuevo para desactivar.');
        } else {
            await ctx.reply('🔇 Talk Mode DESACTIVADO. Vuelvo a responder solo con texto.');
        }
    });

    // Función auxiliar para enviar texto, audio opcional, y archivos
    const sendResponseWithAudio = async (ctx: any, agentResponse: string) => {
        const userId: number = ctx.from?.id ?? 0;

        // Verificar si el modelo decidió enviar un audio o si Talk Mode está activo
        const shouldSendAudio = agentResponse.includes('<VOICE>') || isTalkModeOn(userId);

        // Extraer archivos si usó la etiqueta <FILE:ruta>
        const fileRegex = /<FILE:(.*?)>/g;
        const filesToSend: string[] = [];
        let cleanResponse = agentResponse.replace(fileRegex, (match, filePath) => {
            filesToSend.push(filePath.trim());
            return ''; // Remover la etiqueta del texto
        });

        // Limpiar la etiqueta de voz
        cleanResponse = cleanResponse.replace(/<VOICE>/g, '').trim();

        if (cleanResponse.length > 4000) {
            await ctx.reply(cleanResponse.substring(0, 4000) + '... [truncado]');
        } else if (cleanResponse.length > 0) {
            await ctx.reply(cleanResponse);
        }

        // Enviar archivos extraidos
        for (const filePath of filesToSend) {
            if (fs.existsSync(filePath)) {
                await ctx.replyWithDocument(new InputFile(filePath));
            } else {
                console.warn(`[Bot] Archivo no encontrado para enviar: ${filePath}`);
            }
        }

        // Generar y enviar audio
        if (shouldSendAudio && cleanResponse.length > 0) {
            await ctx.replyWithChatAction('record_voice');

            const audioBuffer = await generateSpeechifyAudio(cleanResponse);
            if (audioBuffer) {
                await ctx.replyWithVoice(new InputFile(audioBuffer, "voice.mp3"));
            }
        }
    };

    // Manejar mensajes de texto
    bot.on('message:text', async (ctx) => {
        try {
            await ctx.replyWithChatAction('typing');
            const response = await processUserMessage(ctx.from.id, ctx.message.text);
            await sendResponseWithAudio(ctx, response);
        } catch (error) {
            console.error("[Bot Error]", error);
            ctx.reply("Ups, ocurrió un error interno al procesar tu mensaje.");
        }
    });

    // Handler compartido para procesar audio (voice o audio file)
    const handleAudioMessage = async (ctx: any, fileId: string) => {
        try {
            await ctx.replyWithChatAction('typing');

            const file = await ctx.api.getFile(fileId);

            if (!file.file_path) {
                await ctx.reply("No pude descargar el audio.");
                return;
            }

            // Transcribir usando el módulo de voz dedicado
            const transcribedText = await transcribeVoiceMessage(fileId, file.file_path);

            if (!transcribedText || transcribedText.trim() === '') {
                await ctx.reply("No pude entender bien el audio o estaba vacío.");
                return;
            }

            // Mostrar qué escuchó el bot
            await ctx.reply(`🎤 _He escuchado:_ "${transcribedText}"`, { parse_mode: 'Markdown' });

            // Procesar el texto transcrito como un mensaje de texto normal
            const agentResponse = await processUserMessage(ctx.from.id, transcribedText);
            await sendResponseWithAudio(ctx, agentResponse);

        } catch (error) {
            console.error("[Bot Error Audio]", error);
            ctx.reply("Ups, ocurrió un error interno al procesar tu audio.");
        }
    };

    // Manejar notas de voz (grabadas con el micrófono)
    bot.on('message:voice', async (ctx) => {
        await handleAudioMessage(ctx, ctx.message.voice.file_id);
    });

    // Manejar archivos de audio (enviados como adjunto)
    bot.on('message:audio', async (ctx) => {
        await handleAudioMessage(ctx, ctx.message.audio.file_id);
    });

    return bot;
};
