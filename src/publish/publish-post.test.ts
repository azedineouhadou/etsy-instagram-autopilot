import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Post } from '../schemas/post.js';
import { InstagramApiError, type ContainerStatus, type InstagramApi } from './instagram.js';
import { publishPost, selectDue, type InstagramState, type PublishDeps } from './publish-post.js';

const NOW = new Date('2026-11-10T12:00:00Z');

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: '2026-11-02-test',
    listingId: '1234567890',
    scheduledAt: '2026-11-02T18:00:00+01:00',
    approved: true,
    media: { type: 'image', file: 'media/01.jpg' },
    caption: 'Hello',
    hashtags: ['#coloring'],
    ...overrides,
  };
}

/** Fake Instagram: records calls; each container walks through the given statuses, ending FINISHED */
class FakeApi implements InstagramApi {
  calls: string[] = [];
  private n = 0;
  constructor(private statuses: Record<string, ContainerStatus[]> = {}) {}

  private next(kind: string) {
    return `${kind}-${++this.n}`;
  }
  async createImage(p: { imageUrl: string; caption?: string; carouselItem?: boolean }) {
    this.calls.push(`${p.carouselItem ? 'item' : 'image'} ${p.imageUrl}${p.caption ? ` "${p.caption}"` : ''}`);
    return this.next('c');
  }
  async createCarousel(p: { children: string[]; caption: string }) {
    this.calls.push(`carousel ${p.children.join(',')}`);
    return this.next('c');
  }
  async createReel(p: { videoUrl: string; coverUrl?: string }) {
    this.calls.push(`reel ${p.videoUrl} cover=${p.coverUrl}`);
    return this.next('c');
  }
  async containerStatus(id: string) {
    const queue = this.statuses[id];
    const status = queue?.length ? queue.shift()! : 'FINISHED';
    this.calls.push(`status ${id} ${status}`);
    return { status };
  }
  async publish(id: string) {
    this.calls.push(`publish ${id}`);
    return 'media-99';
  }
  async permalink() {
    return 'https://www.instagram.com/p/abc/';
  }
  async quota() {
    return { used: 0, total: 50 };
  }
}

function deps(api: InstagramApi, saved: InstagramState[] = []): PublishDeps {
  let clock = NOW.getTime();
  return {
    api,
    mediaUrl: (f) => `https://cdn.test/${f}`,
    saveState: (s) => saved.push(s),
    now: () => new Date(clock),
    sleep: async (ms) => {
      clock += ms;
    },
    poll: { intervalMs: 1000, timeoutMs: 5000 },
  };
}

describe('selectDue', () => {
  it('keeps approved posts whose time has passed, oldest first, capped', () => {
    const posts = [
      post({ id: '2026-11-03-b', scheduledAt: '2026-11-03T18:00:00+01:00' }),
      post({ id: '2026-11-01-a', scheduledAt: '2026-11-01T18:00:00+01:00' }),
      post({ id: '2026-11-04-held', scheduledAt: '2026-11-04T18:00:00+01:00', approved: false }),
      post({ id: '2026-12-01-future', scheduledAt: '2026-12-01T18:00:00+01:00' }),
      post({ id: '2026-11-05-c', scheduledAt: '2026-11-05T18:00:00+01:00' }),
    ];
    assert.deepEqual(
      selectDue(posts, NOW, 2).map((p) => p.id),
      ['2026-11-01-a', '2026-11-03-b'],
    );
  });

  it('compares instants, not local clock times', () => {
    // 18:30+01:00 is 17:30Z — due at 17:45Z
    const p = post({ scheduledAt: '2026-11-10T18:30:00+01:00' });
    assert.equal(selectDue([p], new Date('2026-11-10T17:45:00Z'), 5).length, 1);
    assert.equal(selectDue([p], new Date('2026-11-10T17:15:00Z'), 5).length, 0);
  });
});

describe('publishPost', () => {
  it('image: container with caption + hashtags, then publish, saving state along the way', async () => {
    const api = new FakeApi();
    const saved: InstagramState[] = [];
    const result = await publishPost(post(), deps(api, saved));

    assert.deepEqual(api.calls, ['image https://cdn.test/media/01.jpg "Hello\n\n#coloring"', 'status c-1 FINISHED', 'publish c-1']);
    assert.equal(result.mediaId, 'media-99');
    assert.equal(result.permalink, 'https://www.instagram.com/p/abc/');
    assert.deepEqual(saved[0], { containerId: 'c-1' });
    assert.equal(saved.at(-1)?.mediaId, 'media-99');
    assert.equal(saved.at(-1)?.permalink, 'https://www.instagram.com/p/abc/');
  });

  it('carousel: one item per slide (no caption), then the carousel container', async () => {
    const api = new FakeApi();
    await publishPost(post({ media: { type: 'carousel', files: ['media/01.jpg', 'media/02.jpg'] } }), deps(api));
    assert.deepEqual(api.calls, [
      'item https://cdn.test/media/01.jpg',
      'status c-1 FINISHED',
      'item https://cdn.test/media/02.jpg',
      'status c-2 FINISHED',
      'carousel c-1,c-2',
      'status c-3 FINISHED',
      'publish c-3',
    ]);
  });

  it('reel: waits while Instagram processes the video', async () => {
    const api = new FakeApi({ 'c-1': ['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'] });
    await publishPost(
      post({ media: { type: 'reel', video: 'media/reel.mp4', cover: 'media/cover.jpg', shareToFeed: true } }),
      deps(api),
    );
    assert.deepEqual(api.calls, [
      'reel https://cdn.test/media/reel.mp4 cover=https://cdn.test/media/cover.jpg',
      'status c-1 IN_PROGRESS',
      'status c-1 IN_PROGRESS',
      'status c-1 FINISHED',
      'publish c-1',
    ]);
  });

  it('fails without publishing when processing errors', async () => {
    const api = new FakeApi({ 'c-1': ['ERROR'] });
    await assert.rejects(publishPost(post(), deps(api)), /c-1 ERROR/);
    assert.ok(!api.calls.some((c) => c.startsWith('publish')));
  });

  it('gives up after the timeout', async () => {
    const api = new FakeApi({ 'c-1': Array<ContainerStatus>(20).fill('IN_PROGRESS') });
    await assert.rejects(publishPost(post(), deps(api)), /still IN_PROGRESS after 5s/);
    assert.ok(!api.calls.some((c) => c.startsWith('publish')));
  });
});

describe('publishPost — never posts twice', () => {
  it('a recorded mediaId means done: no API calls at all', async () => {
    const api = new FakeApi();
    const result = await publishPost(post({ instagram: { containerId: 'c-old', mediaId: 'media-1' } }), deps(api));
    assert.deepEqual(api.calls, []);
    assert.equal(result.resumed, true);
    assert.equal(result.mediaId, 'media-1');
  });

  it('a container already PUBLISHED is not published again', async () => {
    const api = new FakeApi({ 'c-old': ['PUBLISHED'] });
    const result = await publishPost(post({ instagram: { containerId: 'c-old' } }), deps(api));
    assert.deepEqual(api.calls, ['status c-old PUBLISHED']);
    assert.equal(result.resumed, true);
  });

  it('a FINISHED container left by a crashed run is published, not recreated', async () => {
    const api = new FakeApi({ 'c-old': ['FINISHED'] });
    await publishPost(post({ instagram: { containerId: 'c-old' } }), deps(api));
    assert.deepEqual(api.calls, ['status c-old FINISHED', 'publish c-old']);
  });

  it('an EXPIRED container is replaced by a fresh one', async () => {
    const api = new FakeApi({ 'c-old': ['EXPIRED'] });
    await publishPost(post({ instagram: { containerId: 'c-old' } }), deps(api));
    assert.deepEqual(api.calls, ['status c-old EXPIRED', 'image https://cdn.test/media/01.jpg "Hello\n\n#coloring"', 'status c-1 FINISHED', 'publish c-1']);
  });
});

describe('publishPost — flaky network', () => {
  it('keeps polling through a dropped connection, then publishes', async () => {
    const api = new FakeApi({ 'c-1': ['IN_PROGRESS', 'FINISHED'] });
    const real = api.containerStatus.bind(api);
    let failed = false;
    api.containerStatus = async (id: string) => {
      if (!failed) {
        failed = true;
        throw new InstagramApiError('GET /c-1: network error (TypeError)', 0);
      }
      return real(id);
    };
    const result = await publishPost(post(), deps(api));
    assert.equal(result.mediaId, 'media-99');
    assert.ok(api.calls.includes('publish c-1'));
  });

  it('still fails fast on a real API error while polling', async () => {
    const api = new FakeApi();
    api.containerStatus = async () => {
      throw new InstagramApiError('GET /c-1: Invalid parameter', 400, 100);
    };
    await assert.rejects(publishPost(post(), deps(api)), /Invalid parameter/);
    assert.ok(!api.calls.some((c) => c.startsWith('publish')));
  });
});
