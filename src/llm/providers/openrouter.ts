import { LLMProvider, LLMProviderConfig, LLMResponse, registerProvider } from './index.js';
import { config } from '../../config.js';

class OpenRouterProvider implements LLMProvider {
    id = 'openrouter';
    name = 'OpenRouter';

    isConfigured(): boolean {
        return !!config.OPENROUTER_API_KEY;
    }

    async chatCompletion(messages: any[], providerConfig: LLMProviderConfig): Promise<LLMResponse> {
        if (!this.isConfigured()) {
            throw new Error("OpenRouter API Key not configured");
        }

        const fullMessages = providerConfig.systemPrompt
            ? [{ role: 'system', content: providerConfig.systemPrompt }, ...messages]
            : messages;

        // OpenRouter uses `include_reasoning` or `provider.quantizations` or something similar for thinking models,
        // but it mostly depends on the model selected. OpenAI o1/o3 support thinking parameters if exposed.
        // We'll pass the standard ones, plus a custom provider routing config if needed.

        const openRouterOptions: any = {
            model: providerConfig.model,
            messages: fullMessages,
            max_tokens: providerConfig.maxTokens || 4096,
            temperature: providerConfig.temperature ?? 0.5,
        };

        if (providerConfig.tools && providerConfig.tools.length > 0) {
            openRouterOptions.tools = providerConfig.tools;
        }

        // Add thinking / reasoning options based on the level if it's a model that supports it (like anthropic models or general openrouter reasoning parameters)
        // Some models track "reasoning_effort" / "thought_level" ? We'll leave it generic for now.
        if (providerConfig.thinkLevel && providerConfig.thinkLevel !== 'off') {
            // For openrouter, routing config can sometimes set thinking, or we just rely on standard params.
            // We can map thinkLevel to temperature or specific reasoning params once models standardize.
            // For instance OpenAI o1 uses reasoning_effort = 'low', 'medium', 'high'.
            openRouterOptions.reasoning_effort = providerConfig.thinkLevel;
            // Some models like claude 3.7 sonnet support 'thinking' block
            if (providerConfig.model.includes('claude-3.7-sonnet')) {
                const budget = providerConfig.thinkLevel === 'low' ? 1024 : providerConfig.thinkLevel === 'medium' ? 4096 : 8192;
                openRouterOptions.thinking = { type: 'enabled', budget_tokens: budget };
            }
        }

        const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/0rgan1co/gravityclaw",
                "X-Title": "GravityClaw"
            },
            body: JSON.stringify(openRouterOptions)
        });

        if (!openRouterRes.ok) {
            const errorText = await openRouterRes.text();
            throw new Error(`OpenRouter Error: ${errorText}`);
        }

        const openRouterData = await openRouterRes.json();
        const choice = openRouterData.choices[0];

        return {
            content: choice?.message?.content || null,
            toolCalls: choice?.message?.tool_calls,
        };
    }
}

export const openRouterProvider = new OpenRouterProvider();
registerProvider(openRouterProvider);
