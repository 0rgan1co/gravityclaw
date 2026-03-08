import 'dotenv/config';
import { saveMemory } from './src/memory/index.js';

const userId = 300304544; // Vimos este ID en los logs de error anteriores
const tipo = 'preference';
const content = `CRITERIO CLAVE DE DESARROLLO (SUPERPOWERS): "Quiero que mi asistente de IA (Njambre) tenga 'superpoderes' de programación para ayudarme a desarrollar soluciones digitales funcionales y atractivas, minimizando los costos al máximo (Stack de Costo Cero: HTML/CSS/JS puro, Vite, Vercel, Supabase, Groq/OpenRouter). No voy a codear yo, tú debes ayudarme creando los archivos completos listos para correr."`;

saveMemory(userId, tipo, content, "conversation_superpowers");
console.log("Memoria inyectada exitosamente para el usuario", userId);
