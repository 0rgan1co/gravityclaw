import { config } from '../config.js';

/**
 * Genera un audio a partir de texto usando Speechify API
 */
export const generateSpeechifyAudio = async (text: string): Promise<Buffer | null> => {
    try {
        if (!config.SPEECHIFY_API_KEY) {
            console.warn("[Speechify] API Key no configurada.");
            return null;
        }

        const res = await fetch('https://api.speechify.ai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.SPEECHIFY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input: text,
                // Puedes usar diferentes voces. 'george' es un ejemplo de voz masculina en español o inglés
                // Otras opciones: 'simon', 'cliff', etc. Speechify intentará detectar y usar el acento.
                voice_id: "george"
            })
        });

        if (!res.ok) {
            const error = await res.text();
            console.error("[Speechify] Error generando audio:", error);
            return null;
        }

        const data = await res.json();
        const base64Audio = data.audio_data || data.audioData || data.data;

        if (!base64Audio) {
            console.error("[Speechify] Formato de respuesta JSON inesperado.");
            return null;
        }

        return Buffer.from(base64Audio, 'base64');
    } catch (error) {
        console.error("[Speechify] Excepción al generar audio:", error);
        return null;
    }
};
