#!/usr/bin/env node
/**
 * Turn a password into the hash string for APP_PASSWORD_HASH.
 *
 * Run it yourself:   npm run hash-password
 *
 * The password is read from a hidden prompt, used once, and discarded. It is
 * never written to disk, never sent anywhere, and never appears in shell
 * history. Only the printed hash goes into your env vars — and the hash alone
 * can't be reversed back into the password.
 */

import readline from 'node:readline';
import { webcrypto as crypto } from 'node:crypto';

const PBKDF2_ITERATIONS = 210_000;
const enc = new TextEncoder();

function b64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return new Uint8Array(bits);
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Suppress echo so the password isn't visible on screen.
    const onData = (char) => {
      const s = char.toString();
      if (s === '\n' || s === '\r' || s === '') {
        process.stdin.removeListener('data', onData);
      } else {
        process.stdout.write('\x1b[2K\x1b[200D' + question + '*'.repeat(rl.line.length));
      }
    };
    process.stdin.on('data', onData);

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const password = await promptHidden('Choose a password: ');

if (!password || password.length < 10) {
  console.error(
    '\nPassword must be at least 10 characters. This is the only thing standing\n' +
      'between a public URL and your data — use something long.\n'
  );
  process.exit(1);
}

const confirm = await promptHidden('Confirm password: ');
if (password !== confirm) {
  console.error('\nPasswords did not match. Nothing was written.\n');
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);

// ':' rather than the conventional '$' — env loaders expand '$' as a variable
// reference and would silently corrupt this value. See lib/auth.ts.
const stored = ['pbkdf2', PBKDF2_ITERATIONS, b64(salt), b64(hash)].join(':');

const authSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
const agentToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');

console.log(`
Done. Add these to .env.local (local dev) and to Vercel's environment
variables (Project Settings -> Environment Variables) for production.

APP_PASSWORD_HASH=${stored}
AUTH_SECRET=${authSecret}
AGENT_API_TOKEN=${agentToken}

Keep them out of git — .gitignore already excludes .env.local.
`);
