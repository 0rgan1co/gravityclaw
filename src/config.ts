import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    TELEGRAM_BOT_TOKEN: z.string().min(1, "El token del bot de Telegram es obligatorio"),
    TELEGRAM_ALLOWED_USER_IDS: z.string().min(1, "Se requieren los IDs permitidos de usuario de Telegram"),
    GROQ_API_KEY: z.string().min(1, "Groq API key es obligatoria"),
    ZAI_API_KEY: z.string().optional(),
    ZAI_MODEL: z.string().default('glm-4-flash'),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_CODING_MODEL: z.string().default('gpt-4o'),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_MODEL: z.string().default('openrouter/free'),
    OPENROUTER_CODING_MODEL: z.string().default('anthropic/claude-4.6-opus'),
    DB_PATH: z.string().default('./memory.db'),
    SPEECHIFY_API_KEY: z.string().optional(),
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
    ZAI_API_KEY: envParsed.data.ZAI_API_KEY,
    ZAI_MODEL: envParsed.data.ZAI_MODEL,
    OPENAI_API_KEY: envParsed.data.OPENAI_API_KEY,
    OPENAI_CODING_MODEL: envParsed.data.OPENAI_CODING_MODEL,
    OPENROUTER_API_KEY: envParsed.data.OPENROUTER_API_KEY,
    OPENROUTER_MODEL: envParsed.data.OPENROUTER_MODEL,
    OPENROUTER_CODING_MODEL: envParsed.data.OPENROUTER_CODING_MODEL,
    DB_PATH: envParsed.data.DB_PATH,
    SPEECHIFY_API_KEY: envParsed.data.SPEECHIFY_API_KEY,
};
