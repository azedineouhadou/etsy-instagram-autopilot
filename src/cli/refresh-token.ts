import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { InstagramClient } from '../publish/instagram.js';

// Run by .github/workflows/refresh-token.yml. The new token goes to a file (never stdout) so it
// can be piped into `gh secret set` without appearing in the Actions log.
const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (!values.out) {
  console.error('✗ --out <file> is required');
  process.exit(1);
}

const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('✗ INSTAGRAM_ACCESS_TOKEN is not set');
  process.exit(1);
}

try {
  const api = new InstagramClient({ userId: 'me', accessToken: token, apiVersion: process.env.INSTAGRAM_API_VERSION?.trim() || 'v25.0' });
  const { accessToken, expiresInSeconds } = await api.refreshToken();
  writeFileSync(values.out, accessToken, { mode: 0o600 });
  console.log(`✓ Token refreshed, valid for ${Math.round(expiresInSeconds / 86_400)} more days`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
