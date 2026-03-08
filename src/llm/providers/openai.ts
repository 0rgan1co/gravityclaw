import { LLMProvider, LLMProviderConfig, LLMResponse, registerProvider } from './index.js';
import { config } from '../../config.js';

class OpenAIProvider implements LLMProvider {
    id = 'openai';
    name = 'OpenAI';

    isConfigured(): boolean {
        return !!config.OPENAI_API_KEY;
    }

    async chatCompletion(messages: any[], providerConfig: LLMProviderConfig): Promise<LLMResponse> {
        if (!this.isConfigured()) {
            throw new Error("OpenAI API Key not configured");
        }

        const fullMessages = providerConfig.systemPrompt
            ? [{ role: 'system', content: providerConfig.systemPrompt }, ...messages]
            : messages;

        const options: any = {
            model: providerConfig.model,
            messages: fullMessages,
            max_tokens: providerConfig.maxTokens || 4096,
            temperature: providerConfig.temperature ?? 0.5,
        };

        if (providerConfig.tools && providerConfig.tools.length > 0) {
            options.tools = providerConfig.tools;
        }

        if (providerConfig.thinkLevel && providerConfig.thinkLevel !== 'off') {
            options.reasoning_effort = providerConfig.thinkLevel;
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(options)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`OpenAI Error: ${errorText}`);
        }

        const data = await res.json();
        const choice = data.choices[0];

        return {
            content: choice?.message?.content || null,
            toolCalls: choice?.message?.tool_calls,
        };
    }
}

export const openAIProvider = new OpenAIProvider();
registerProvider(openAIProvider);
