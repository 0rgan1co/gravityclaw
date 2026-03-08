export interface LLMProviderConfig {
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    tools?: any[];
    thinkLevel?: 'off' | 'low' | 'medium' | 'high';
}

export interface LLMResponse {
    content: string | null;
    toolCalls?: any[];
}

export interface LLMProvider {
    id: string; // e.g. 'openrouter', 'openai', 'groq', 'ollama'
    name: string;

    chatCompletion(messages: any[], config: LLMProviderConfig): Promise<LLMResponse>;
    isConfigured(): boolean;
}

export const providersRegistry = new Map<string, LLMProvider>();

export const registerProvider = (provider: LLMProvider) => {
    providersRegistry.set(provider.id, provider);
};

export const getProvider = (id: string): LLMProvider | undefined => {
    return providersRegistry.get(id);
};
