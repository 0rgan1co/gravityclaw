import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    TELEGRAM_BOT_TOKEN: z.string().min(1, "El token del bot de Telegram es obligatorio"),
    TELEGRAM_ALLOWED_USER_IDS: z.string().min(1, "Se requieren los IDs permitidos de usuario de Telegram"),
    GROQ_API_KEY: z.string().min(1, "Groq API key es obligatoria"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_MODEL: z.string().default('openrouter/free'),
    DB_PATH: z.string().default('./memory.db'),
});

const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
    console.error("❌ Invalid environment variables:", envParsed.error.format());
    process.exit(1);
}

export const config = {
    TELEGRAM_BOT_TOKEN: envParsed.data.TELEGRAM_BOT_TOKEN,
    TELEGRAM_ALLOWED_USER_IDS: envParsed.data.TELEGRAM_ALLOWED_USER_IDS.split(',').map((id) => parseInt(id.trim(), 10)).filter(id => !isNaN(id)),
    GROQ_API_KEY: envParsed.data.GROQ_API_KEY,
    OPENROUTER_API_KEY: envParsed.data.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: envParsed.data.OPENROUTER_MODEL,
    DB_PATH: envParsed.data.DB_PATH,
};
