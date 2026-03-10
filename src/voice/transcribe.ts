import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { transcribeAudio } from '../llm/index.js';

export interface TranscriptionResult {
    text: string;
    tempPath: string;
}

/**
 * Descarga un archivo de voz de Telegram y lo transcribe con Whisper.
 * Retorna el texto transcrito. Limpia el archivo temporal automáticamente.
 */
export const transcribeVoiceMessage = async (
    fileId: string,
    filePath: string
): Promise<string> => {
    const url = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${filePath}`;
    const tempPath = path.join(process.cwd(), `${fileId}.ogg`);

    try {
        // Descargar el archivo de Telegram
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error descargando audio: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(tempPath, Buffer.from(buffer));

        // Transcribir con Whisper via Groq
        const transcribedText = await transcribeAudio(tempPath);
        return transcribedText;
    } finally {
        // Siempre limpiar el archivo temporal
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
};
