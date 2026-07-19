import axios from 'axios';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export async function groqChat(
  messages: Array<{ role: string; content: string }>,
  model: string = 'llama-3.1-8b-instant',
  temperature: number = 0.3,
  maxTokens: number = 2048
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const response = await axios.post(
    `${GROQ_BASE_URL}/chat/completions`,
    {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.choices[0]?.message?.content || '';
}

export async function groqJsonChat<T>(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'llama-3.1-8b-instant'
): Promise<T> {
  const raw = await groqChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    model,
    0.1
  );

  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse Groq response as JSON: ${raw.substring(0, 200)}`);
  }
}
