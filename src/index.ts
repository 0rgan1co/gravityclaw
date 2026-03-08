import { setupBot } from './bot/index.js';

async function bootstrap() {
    console.log("🚀 Iniciando OpenGravity...");

    try {
        const bot = setupBot();

        // Configurar manejo de errores asíncronos en grammy
        bot.catch((err) => {
            const ctx = err.ctx;
            console.error(`Error mientras se manejaba la actualización ${ctx.update.update_id}:`);
            const e = err.error;
            console.error(e);
        });

        // Iniciar poling
        bot.start({
            onStart: (botInfo) => {
                console.log(`✅ Bot conectado y corriendo exitosamente como @${botInfo.username}`);
            }
        });

        // Capturar señales de cierre para apagar elegantemente (Graceful shutdown)
        process.once('SIGINT', () => {
            console.log('🔄 Deteniendo bot...');
            bot.stop();
            process.exit();
        });
        process.once('SIGTERM', () => {
            console.log('🔄 Deteniendo bot...');
            bot.stop();
            process.exit();
        });

    } catch (error) {
        console.error("❌ Falla crítica al inicializar OpenGravity:", error);
        process.exit(1);
    }
}

bootstrap();
