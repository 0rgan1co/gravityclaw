import { Bot } from 'grammy';
import { config } from '../config.js';
import { processUserMessage } from '../agent/index.js';
import { clearUserHistory } from '../memory/index.js';

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

    // Manejar mensajes de texto
    bot.on('message:text', async (ctx) => {
        try {
            // Indicador visual de que el agente está escribiendo/pensando
            await ctx.replyWithChatAction('typing');

            const response = await processUserMessage(ctx.from.id, ctx.message.text);

            // La API de Telegram tiene un límite de 4096 caracteres por mensaje.
            // Si la respuesta es más larga, podríamos dividirla, pero para mantener la simplicidad:
            if (response.length > 4000) {
                await ctx.reply(response.substring(0, 4000) + '... [truncado]');
            } else {
                await ctx.reply(response);
            }

        } catch (error) {
            console.error("[Bot Error]", error);
            ctx.reply("Ups, ocurrió un error interno al procesar tu mensaje.");
        }
    });

    return bot;
};
