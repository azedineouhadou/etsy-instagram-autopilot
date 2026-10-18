import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InstagramApiError, InstagramClient } from './instagram.js';

const TOKEN = 'secret-token-123';

type Seen = { url: string; method: string; body: URLSearchParams | null };

function client(respond: (seen: Seen) => { status?: number; json: unknown }, seen: Seen[] = []) {
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    const s: Seen = {
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? new URLSearchParams(init.body) : null,
    };
    seen.push(s);
    const { status = 200, json } = respond(s);
    return new Response(JSON.stringify(json), { status });
  }) as typeof fetch;
  return new InstagramClient({ userId: '1789', accessToken: TOKEN, apiVersion: 'v25.0', fetch: fakeFetch });
}

describe('InstagramClient', () => {
  it('creates a reel container with the documented parameter names', async () => {
    const seen: Seen[] = [];
    const id = await client(() => ({ json: { id: 'c-1' } }), seen).createReel({
      videoUrl: 'https://cdn.test/reel.mp4',
      coverUrl: 'https://cdn.test/cover.jpg',
      caption: 'Hi',
      shareToFeed: true,
    });
    assert.equal(id, 'c-1');
    assert.equal(seen[0]?.url, 'https://graph.instagram.com/v25.0/1789/media');
    assert.equal(seen[0]?.method, 'POST');
    const body = Object.fromEntries(seen[0]!.body!);
    assert.deepEqual(body, {
      media_type: 'REELS',
      video_url: 'https://cdn.test/reel.mp4',
      cover_url: 'https://cdn.test/cover.jpg',
      caption: 'Hi',
      share_to_feed: 'true',
      access_token: TOKEN,
    });
  });

  it('omits unset optional parameters', async () => {
    const seen: Seen[] = [];
    await client(() => ({ json: { id: 'c-2' } }), seen).createImage({ imageUrl: 'https://cdn.test/a.jpg', carouselItem: true });
    assert.deepEqual(Object.fromEntries(seen[0]!.body!), {
      image_url: 'https://cdn.test/a.jpg',
      is_carousel_item: 'true',
      access_token: TOKEN,
    });
  });

  it('publishes with creation_id and reads the quota', async () => {
    const seen: Seen[] = [];
    const api = client(
      (s) =>
        s.url.includes('content_publishing_limit')
          ? { json: { data: [{ quota_usage: 3, config: { quota_total: 50, quota_duration: 86400 } }] } }
          : { json: { id: 'media-1' } },
      seen,
    );
    assert.equal(await api.publish('c-9'), 'media-1');
    assert.equal(seen[0]?.url, 'https://graph.instagram.com/v25.0/1789/media_publish');
    assert.equal(seen[0]?.body?.get('creation_id'), 'c-9');
    assert.deepEqual(await api.quota(), { used: 3, total: 50 });
  });

  it("turns API errors into readable messages that don't contain the token", async () => {
    const api = client(() => ({ status: 400, json: { error: { message: 'Invalid parameter', code: 100 } } }));
    await assert.rejects(api.containerStatus('c-1'), (err: unknown) => {
      assert.ok(err instanceof InstagramApiError);
      assert.equal(err.message, 'GET /c-1: Invalid parameter');
      assert.equal(err.code, 100);
      assert.ok(!err.message.includes(TOKEN));
      return true;
    });
  });

  it("network failures don't leak the URL either", async () => {
    const api = new InstagramClient({
      userId: '1789',
      accessToken: TOKEN,
      apiVersion: 'v25.0',
      fetch: (async () => {
        throw new TypeError(`fetch failed for https://graph.instagram.com/?access_token=${TOKEN}`);
      }) as typeof fetch,
    });
    await assert.rejects(api.permalink('m-1'), (err: Error) => !err.message.includes(TOKEN) && /network error/.test(err.message));
  });
});

describe('InstagramClient.me', () => {
  it('asks /me for user_id, username and account type', async () => {
    const seen: Seen[] = [];
    const me = await client(() => ({ json: { user_id: '1784', username: 'pixoraprintscrafts', account_type: 'Business' } }), seen).me();
    assert.ok(seen[0]?.url.startsWith('https://graph.instagram.com/v25.0/me?fields=user_id%2Cusername%2Caccount_type&'));
    assert.deepEqual(me, { userId: '1784', username: 'pixoraprintscrafts', accountType: 'Business' });
  });
});

describe('InstagramClient config', () => {
  it('rejects a malformed API version with a clear message', () => {
    assert.throws(
      () => new InstagramClient({ userId: '1', accessToken: TOKEN, apiVersion: 'v25.0.' }),
      /INSTAGRAM_API_VERSION must look like v25.0 \(got "v25.0."\)/,
    );
  });
});

describe('InstagramClient.refreshToken', () => {
  it('calls the unversioned refresh endpoint and returns the new token', async () => {
    const seen: Seen[] = [];
    const res = await client(() => ({ json: { access_token: 'new-token', token_type: 'bearer', expires_in: 5_184_000 } }), seen).refreshToken();
    assert.ok(seen[0]?.url.startsWith('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&'));
    assert.deepEqual(res, { accessToken: 'new-token', expiresInSeconds: 5_184_000 });
  });

  it('errors on a refresh failure without echoing the token', async () => {
    const api = client(() => ({ status: 400, json: { error: { message: 'Session has expired', code: 190 } } }));
    await assert.rejects(api.refreshToken(), (err: Error) => err.message === 'GET /refresh_access_token: Session has expired' && !err.message.includes(TOKEN));
  });
});
