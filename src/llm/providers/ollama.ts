import { LLMProvider, LLMProviderConfig, LLMResponse, registerProvider } from './index.js';

class OllamaProvider implements LLMProvider {
    id = 'ollama';
    name = 'Ollama (Local)';

    isConfigured(): boolean {
        // Assume always accessible natively for a local install
        return true;
    }

    async chatCompletion(messages: any[], providerConfig: LLMProviderConfig): Promise<LLMResponse> {
        const fullMessages = providerConfig.systemPrompt
            ? [{ role: 'system', content: providerConfig.systemPrompt }, ...messages]
            : messages;

        // Using standard OpenAI-compatible endpoint from Ollama
        // Typical locally bound port is 11434
        const options: any = {
            model: providerConfig.model,
            messages: fullMessages,
            temperature: providerConfig.temperature ?? 0.5,
        };

        if (providerConfig.tools && providerConfig.tools.length > 0) {
            options.tools = providerConfig.tools;
        }

        const res = await fetch("http://localhost:11434/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(options)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Ollama Error: ${errorText}`);
        }

        const data = await res.json();
        const choice = data.choices[0];

        return {
            content: choice?.message?.content || null,
            toolCalls: choice?.message?.tool_calls,
        };
    }
}

export const ollamaProvider = new OllamaProvider();
registerProvider(ollamaProvider);
