import { LLMProvider, LLMProviderConfig, LLMResponse, registerProvider } from './index.js';
import { config } from '../../config.js';
import Groq from 'groq-sdk';

class GroqProvider implements LLMProvider {
    id = 'groq';
    name = 'Groq';
    private client: Groq | null = null;

    isConfigured(): boolean {
        return !!config.GROQ_API_KEY;
    }

    private getClient() {
        if (!this.client && config.GROQ_API_KEY) {
            this.client = new Groq({ apiKey: config.GROQ_API_KEY });
        }
        return this.client;
    }

    async chatCompletion(messages: any[], providerConfig: LLMProviderConfig): Promise<LLMResponse> {
        const client = this.getClient();
        if (!client) {
            throw new Error("Groq API Key not configured");
        }

        const fullMessages = providerConfig.systemPrompt
            ? [{ role: 'system', content: providerConfig.systemPrompt }, ...messages]
            : messages;

        const response = await client.chat.completions.create({
            model: providerConfig.model,
            messages: fullMessages,
            tools: providerConfig.tools?.length ? providerConfig.tools : undefined,
            tool_choice: providerConfig.tools?.length ? "auto" : undefined,
            max_tokens: providerConfig.maxTokens || 4096,
            temperature: providerConfig.temperature ?? 0.5,
        });

        const choice = response.choices[0];
        return {
            content: choice?.message?.content || null,
            toolCalls: choice?.message?.tool_calls as any,
        };
    }
}

export const groqProvider = new GroqProvider();
registerProvider(groqProvider);
