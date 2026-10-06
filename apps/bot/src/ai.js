// Proveedores de IA de terceros (opcionales, solo con tus API keys).
// Los nombres de modelo se pueden cambiar por variables de entorno cuando un proveedor los retire.

import { UserError } from '@dc-chatbot/core';

const SYSTEM_PROMPT = 'Eres un asistente útil y conciso. Responde en el idioma del usuario.';

function friendlyError(provider, err) {
  const status = err?.status ?? err?.code;
  const text = String(err?.message ?? '').toLowerCase();
  if (status === 429 || text.includes('quota') || text.includes('insufficient')) {
    return new UserError(`${provider} rechazó la petición por límite de uso o créditos agotados.`);
  }
  if (status === 401 || status === 403 || text.includes('api key')) return new UserError(`La API key de ${provider} no es válida.`);
  if (status === 404 || text.includes('model')) return new UserError(`El modelo configurado para ${provider} no existe. Revisa la variable de entorno del modelo.`);
  return err;
}

export function createAiProviders(env = process.env) {
  const keys = { chatgpt: env.OPENAI_API_KEY, grok: env.GROK_API_KEY, gemini: env.GEMINI_API_KEY };
  const models = {
    chatgpt: env.OPENAI_MODEL || 'gpt-4o-mini',
    grok: env.GROK_MODEL || 'grok-3-mini',
    gemini: env.GEMINI_MODEL || 'gemini-2.5-flash',
    image: env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  };
  const clients = {};

  // Los SDK se cargan solo si se usan: el bot arranca rápido aunque no haya claves.
  async function client(provider) {
    if (clients[provider]) return clients[provider];
    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai');
      clients.gemini = new GoogleGenAI({ apiKey: keys.gemini });
    } else {
      const { default: OpenAI } = await import('openai');
      clients[provider] = new OpenAI({ apiKey: keys[provider], ...(provider === 'grok' ? { baseURL: 'https://api.x.ai/v1' } : {}) });
    }
    return clients[provider];
  }

  return {
    isAvailable: (provider) => Boolean(keys[provider]?.trim()),
    configured: () => Object.keys(keys).filter((p) => keys[p]?.trim()),

    async ask(provider, question) {
      try {
        const c = await client(provider);
        if (provider === 'gemini') {
          const res = await c.models.generateContent({ model: models.gemini, contents: question, config: { systemInstruction: SYSTEM_PROMPT } });
          return res.text ?? '';
        }
        const res = await c.chat.completions.create({
          model: models[provider],
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: question }],
          max_tokens: 1500,
        });
        return res.choices[0]?.message?.content ?? '';
      } catch (err) {
        throw friendlyError(provider, err);
      }
    },

    async image(prompt) {
      try {
        const c = await client('chatgpt');
        const res = await c.images.generate({ model: models.image, prompt, size: '1024x1024', n: 1 });
        const out = res.data?.[0];
        return out?.url ? { url: out.url } : { base64: out?.b64_json };
      } catch (err) {
        throw friendlyError('OpenAI', err);
      }
    },
  };
}
