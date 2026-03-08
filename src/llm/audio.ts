import Groq from 'groq-sdk';
import { config } from '../config.js';
import fs from 'fs';

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

export const transcribeAudioGroq = async (filePath: string): Promise<string> => {
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
        console.error("❌ Error en transcribeAudioGroq:", error);
        throw error;
    }
};
