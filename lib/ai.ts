import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';

/**
 * Provider-agnostic structured LLM calls.
 *
 * Two reasons this is abstracted rather than hardcoded to one vendor: the app
 * is a template other people deploy, and they'll already have a key for one or
 * the other — forcing a second account is a pointless barrier. And both SDKs
 * expose the same shape of thing (zod schema in, validated object out), so the
 * abstraction costs almost nothing.
 *
 * Everything here is optional. With no key at all the AI routes return 501 and
 * the UI controls don't render.
 */

export type Provider = 'anthropic' | 'openai';

/**
 * Two tiers, because the two tasks are genuinely different work.
 *
 * `extract` is mechanical: pull stated fields out of text. A small model does
 * that as well as a large one for a fraction of the price.
 *
 * `fit` is a judgement call against someone's background, and it has to be
 * willing to say "Weak". That's where model quality actually shows, so it gets
 * the better tier. Both are env-overridable — the cost/quality tradeoff is the
 * deployer's to make, not ours.
 */
export type Task = 'fit' | 'extract';

const DEFAULT_MODELS: Record<Provider, Record<Task, string>> = {
  anthropic: {
    fit: 'claude-sonnet-4-6',
    extract: 'claude-haiku-4-5',
  },
  openai: {
    fit: 'gpt-4o',
    extract: 'gpt-4o-mini',
  },
};

/** Models that accept Anthropic's adaptive thinking. Others error on it. */
const SUPPORTS_ADAPTIVE_THINKING = ['claude-opus-4-6', 'claude-sonnet-4-6'];

export function activeProvider(): Provider | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (explicit === 'openai' && process.env.OPENAI_API_KEY) return 'openai';

  // No explicit preference: use whichever key is present.
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

export function isAiConfigured(): boolean {
  return activeProvider() !== null;
}

export function modelFor(provider: Provider, task: Task): string {
  const override =
    provider === 'anthropic'
      ? task === 'fit'
        ? process.env.CLAUDE_MODEL
        : process.env.CLAUDE_MODEL_FAST
      : task === 'fit'
        ? process.env.OPENAI_MODEL
        : process.env.OPENAI_MODEL_FAST;

  return override || DEFAULT_MODELS[provider][task];
}

export interface StructuredResult<T> {
  data: T;
  provider: Provider;
  model: string;
}

/**
 * One call, one validated object. Throws on API failure — callers map that to
 * a response via `describeAiError`.
 */
export async function structured<T>({
  task,
  schema,
  schemaName,
  system,
  user,
  maxTokens = 4096,
}: {
  task: Task;
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<StructuredResult<T>> {
  const provider = activeProvider();
  if (!provider) throw new Error('No AI provider configured.');

  const model = modelFor(provider, task);

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      // Anthropic's helper infers the name from the schema; OpenAI's takes one
      // explicitly. schemaName is only used on the OpenAI path below.
      output_config: {
        format: zodOutputFormat(schema as never),
      },
      // Only where it's supported — Haiku 4.5 rejects this parameter.
      ...(SUPPORTS_ADAPTIVE_THINKING.includes(model)
        ? { thinking: { type: 'adaptive' as const } }
        : {}),
    });

    return {
      data: response.parsed_output as T,
      provider,
      model,
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.parse({
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: zodResponseFormat(schema as never, schemaName),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message?.refusal;
    throw new Error(
      refusal
        ? `The model declined to answer: ${refusal}`
        : 'The model returned no structured output.'
    );
  }

  return { data: parsed as T, provider, model };
}

/**
 * Map provider errors to something actionable.
 *
 * "Something went wrong" is useless here — a bad key, an empty balance, and a
 * rate limit need three different responses from the user, and only they can
 * fix any of them.
 */
export function describeAiError(err: unknown): {
  message: string;
  status: number;
} {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof OpenAI.AuthenticationError
  ) {
    return {
      message:
        'The AI provider rejected the API key. Check ANTHROPIC_API_KEY or OPENAI_API_KEY.',
      status: 502,
    };
  }

  if (
    err instanceof Anthropic.RateLimitError ||
    err instanceof OpenAI.RateLimitError
  ) {
    return {
      message: 'Rate limited by the AI provider. Wait a moment and try again.',
      status: 429,
    };
  }

  if (
    err instanceof Anthropic.APIError ||
    err instanceof OpenAI.APIError
  ) {
    if (/credit balance|billing|quota|insufficient_quota/i.test(err.message)) {
      return {
        message:
          'The AI provider reports insufficient credit or quota on this account.',
        status: 402,
      };
    }
    if (/model|not found|does not exist/i.test(err.message)) {
      return {
        message: `Model not available on this account: ${err.message}. Set CLAUDE_MODEL / OPENAI_MODEL to one you have access to.`,
        status: 400,
      };
    }
    return { message: `AI provider error: ${err.message}`, status: 502 };
  }

  return {
    message: err instanceof Error ? err.message : 'Unknown error',
    status: 500,
  };
}
