import { LLMProvider, LLMProviderConfig, LLMResponse, registerProvider } from './index.js';
import { config } from '../../config.js';

class DeepSeekProvider implements LLMProvider {
    id = 'deepseek';
    name = 'DeepSeek';

    isConfigured(): boolean {
        // Assume OPENAI_API_KEY style variable but for deepseek. Let's assume DEEPSEEK_API_KEY
        return !!process.env.DEEPSEEK_API_KEY;
    }

    async chatCompletion(messages: any[], providerConfig: LLMProviderConfig): Promise<LLMResponse> {
        if (!this.isConfigured()) {
            throw new Error("DeepSeek API Key not configured");
        }

        const fullMessages = providerConfig.systemPrompt
            ? [{ role: 'system', content: providerConfig.systemPrompt }, ...messages]
            : messages;

        const options: any = {
            model: providerConfig.model || 'deepseek-chat',
            messages: fullMessages,
            max_tokens: providerConfig.maxTokens || 4096,
            temperature: providerConfig.temperature ?? 0.5,
        };

        if (providerConfig.tools && providerConfig.tools.length > 0) {
            options.tools = providerConfig.tools;
        }

        const res = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(options)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`DeepSeek Error: ${errorText}`);
        }

        const data = await res.json();
        const choice = data.choices[0];

        return {
            content: choice?.message?.content || null,
            toolCalls: choice?.message?.tool_calls,
        };
    }
}

export const deepSeekProvider = new DeepSeekProvider();
registerProvider(deepSeekProvider);
