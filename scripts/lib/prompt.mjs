import readline from 'node:readline';
import { Writable } from 'node:stream';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

export { c };

export const ok = (s) => console.log(`  ${c.green('✓')} ${s}`);
export const warn = (s) => console.log(`  ${c.yellow('!')} ${s}`);
export const bad = (s) => console.log(`  ${c.red('✗')} ${s}`);
export const info = (s) => console.log(`  ${c.dim(s)}`);

export function heading(s) {
  console.log(`\n${c.bold(s)}`);
}

/** True when we can actually run an interactive prompt. */
export function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function ask(question, { fallback = '' } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

export async function confirm(question, { def = true } = {}) {
  const hint = def ? 'Y/n' : 'y/N';
  const answer = (await ask(`${question} ${c.dim(`(${hint})`)} `)).toLowerCase();
  if (!answer) return def;
  return answer === 'y' || answer === 'yes';
}

/**
 * Read a secret without echoing it.
 *
 * Done by muting the readline output stream rather than by hooking
 * process.stdin. The stdin-listener approach — write asterisks on each 'data'
 * event, detach on newline — is fragile in a way that fails open: input does
 * not always arrive one keystroke at a time, and any chunk boundary that
 * doesn't match the detach condition leaves the listener attached, printing
 * stale prompts over later questions and, worse, echoing the password in
 * plain text. Muting the output stream cannot fail that way, and matches what
 * ssh and sudo do.
 */
export function askHidden(question) {
  return new Promise((resolve) => {
    let muted = false;
    const out = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) process.stdout.write(chunk, encoding);
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: out,
      terminal: true,
    });

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });

    // After question() has emitted the prompt, so the prompt itself shows.
    muted = true;
  });
}
