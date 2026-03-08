import { Bot, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { processUserMessage } from '../agent/index.js';
import { clearUserHistory } from '../memory/index.js';
import { transcribeAudio } from '../llm/index.js';
import { generateSpeechifyAudio } from '../speech/index.js';

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
        ctx.reply('Hola. Soy OpenGravity, tu agente personal e interfaz inteligente. Estoy listo para ayudarte. Usa /clear para reiniciar tu memoria.');
    });

    bot.command('clear', async (ctx) => {
        if (ctx.from) {
            await clearUserHistory(ctx.from.id);
            ctx.reply('Memoria borrada. Hemos empezado una nueva conversación.');
        }
    });

    // Función auxiliar para enviar texto y audio opcional
    const sendResponseWithAudio = async (ctx: any, agentResponse: string) => {
        // Verificar si el modelo decidió enviar un audio
        const shouldSendAudio = agentResponse.includes('<VOICE>');

        // Limpiar la etiqueta para que no se vea en el texto final
        const cleanResponse = agentResponse.replace(/<VOICE>/g, '').trim();

        if (cleanResponse.length > 4000) {
            await ctx.reply(cleanResponse.substring(0, 4000) + '... [truncado]');
        } else if (cleanResponse.length > 0) {
            await ctx.reply(cleanResponse);
        }

        // Generar y enviar audio solo si lo solicitó
        if (shouldSendAudio && config.SPEECHIFY_API_KEY) {
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

    // Manejar mensajes de voz
    bot.on('message:voice', async (ctx) => {
        try {
            await ctx.replyWithChatAction('typing'); // Typing action works well enough for audio processing too

            const fileId = ctx.message.voice.file_id;
            const file = await ctx.api.getFile(fileId);

            if (!file.file_path) {
                await ctx.reply("No pude descargar el audio 😢");
                return;
            }

            const url = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

            // Descargar el archivo temporalmente
            const tempPath = path.join(process.cwd(), `${fileId}.ogg`);
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(tempPath, Buffer.from(buffer));

            let transcribedText = "";
            try {
                // Transcribir con Groq Whisper
                transcribedText = await transcribeAudio(tempPath);

                // Responder opcionalmente indicando qué escuchó el bot
                if (transcribedText?.trim()) {
                    await ctx.reply(`🎤 _He escuchado:_ "${transcribedText}"`, { parse_mode: 'Markdown' });
                }
            } finally {
                // Siempre limpiar el archivo temporal
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            }

            if (!transcribedText || transcribedText.trim() === '') {
                await ctx.reply("No pude entender bien el audio o estaba vacío 😢");
                return;
            }

            // Procesar el texto transcrito de la misma forma que un mensaje de texto normal
            const agentResponse = await processUserMessage(ctx.from.id, transcribedText);
            await sendResponseWithAudio(ctx, agentResponse);

        } catch (error) {
            console.error("[Bot Error Audio]", error);
            ctx.reply("Ups, ocurrió un error interno al procesar tu audio.");
        }
    });

    return bot;
};
