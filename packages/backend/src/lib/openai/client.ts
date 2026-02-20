import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

interface ChatCompletionOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ChatCompletionResult {
  content: string;
  tokensUsed: number;
}

/**
 * Generate a chat completion using OpenAI GPT.
 */
export async function generateChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: options.model || "gpt-4o",
    messages: options.messages,
    max_tokens: options.maxTokens || 500,
    temperature: options.temperature ?? 0.7,
  });

  const content = response.choices[0]?.message?.content || "";
  const tokensUsed = response.usage?.total_tokens || 0;

  return { content, tokensUsed };
}
