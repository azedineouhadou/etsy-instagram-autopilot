import { existsSync } from 'node:fs';
import { InstagramClient } from '../publish/instagram.js';

// Phase 4 helper: confirms the token works and prints the account ID to put in .env.
// Reads the token from .env so it never has to be typed into a shell command.
if (existsSync('.env')) process.loadEnvFile('.env');
const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('✗ INSTAGRAM_ACCESS_TOKEN is empty in .env');
  process.exit(1);
}

try {
  const api = new InstagramClient({
    userId: 'me',
    accessToken: token,
    apiVersion: process.env.INSTAGRAM_API_VERSION?.trim() || 'v25.0',
  });
  const me = await api.me();
  console.log(`✓ Token works for @${me.username} (${me.accountType})`);
  console.log(`\n  Put this in .env:\n  INSTAGRAM_USER_ID=${me.userId}`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
