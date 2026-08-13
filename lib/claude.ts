import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API access, server-side only.
 *
 * The AI features are strictly optional: with no ANTHROPIC_API_KEY the app runs
 * exactly as before and the AI controls don't render. That matters because this
 * repo is a template — someone deploying it shouldn't be forced into an API
 * bill to use a tracker.
 */

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claude(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. AI features are optional — see README.'
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Turn an SDK error into something a person can act on.
 *
 * The generic "something went wrong" is useless here: a bad key, an empty
 * balance, and a rate limit need three different responses from the user, and
 * only they can fix any of them.
 */
export function describeClaudeError(err: unknown): {
  message: string;
  status: number;
} {
  if (err instanceof Anthropic.AuthenticationError) {
    return {
      message: 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY.',
      status: 502,
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      message: 'Rate limited by Anthropic. Wait a moment and try again.',
      status: 429,
    };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return {
      message: `Anthropic rejected the request: ${err.message}`,
      status: 400,
    };
  }
  if (err instanceof Anthropic.APIError) {
    // 400 with a credit-balance message is the usual "you ran out" signal.
    if (/credit balance|billing/i.test(err.message)) {
      return {
        message:
          'Anthropic reports insufficient credit on this account. Top up at console.anthropic.com.',
        status: 402,
      };
    }
    return { message: `Anthropic API error: ${err.message}`, status: 502 };
  }
  return {
    message: err instanceof Error ? err.message : 'Unknown error',
    status: 500,
  };
}
