/**
 * Bearer-token gate for the headless agent routes.
 *
 * Shared so every /api/agent/* route authenticates identically — a second
 * hand-rolled copy of this is how one endpoint ends up with a subtly weaker
 * check than the rest.
 */
export function agentAuthorized(request: Request): boolean {
  const expected = process.env.AGENT_API_TOKEN;
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token.length !== expected.length) return false;

  // Constant-time: bail-on-first-mismatch leaks the token prefix by timing.
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
