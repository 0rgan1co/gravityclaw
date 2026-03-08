import { addMessage, getMessageHistory, addToolCallMessage, addToolResponseMessage, getRelevantMemories } from '../memory/index.js';
import { chatCompletion, LLMResponse } from '../llm/index.js';
import { executeTool } from '../tools/index.js';

const MAX_ITERATIONS = 5;

/**
 * Process a user message through the cognitive loop of the agent.
 */
export const processUserMessage = async (userId: number, text: string): Promise<string> => {
    // 1. Guardar mensaje del usuario
    await addMessage(userId, 'user', text);

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // 2. Obtener historial para contexto
        const history = await getMessageHistory(userId);

        // EXTRA: Obtener memorias relevantes a largo plazo (memoria del usuario)
        const memories = getRelevantMemories(userId, 5);
        if (memories.length > 0) {
            const memoryContext = memories.map(m => `- [${m.type}] ${m.content}`).join('\n');
            const memoryMessage = {
                role: 'system',
                content: `Estas son las memorias relevantes del usuario obtenidas de la base de datos a largo plazo:\n${memoryContext}\nUsa esto para personalizar la respuesta.`
            };
            history.unshift(memoryMessage); // Inyectamos la memoria al inicio del historial de este ciclo
        }

        // 3. Consultar al LLM
        const response: LLMResponse = await chatCompletion(history);

        // 4. Evaluar si la IA necesita usar herramientas
        if (response.toolCalls && response.toolCalls.length > 0) {
            // Guardar que el asistente quiere usar herramientas
            await addToolCallMessage(userId, response.toolCalls, response.content);

            // Ejecutar herramientas secuencialmente
            for (const toolCall of response.toolCalls) {
                const toolName = toolCall.function.name;
                const toolArgs = toolCall.function.arguments;

                console.log(`[Agent: ${userId}] Ejecutando tool: ${toolName}...`);

                const result = await executeTool(toolName, toolArgs);

                // Guardar resultado de la herramienta
                await addToolResponseMessage(userId, toolCall.id, result);
            }

            // Volver a consultar al LLM en el siguiente ciclo con los nuevos datos
            continue;
        }

        // 5. Si no hay tool calls, es la respuesta final de texto
        if (response.content) {
            await addMessage(userId, 'assistant', response.content);
            return response.content;
        }

        return "Error: Respuesta inválida generada por la IA.";
    }

    return "Error: Se ha alcanzado el límite máximo de iteraciones de pensamiento. Intenta ser más específico.";
};
