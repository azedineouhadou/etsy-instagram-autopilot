import { fullCaption, type Post } from '../schemas/post.js';
import type { InstagramApi } from './instagram.js';

export type InstagramState = NonNullable<Post['instagram']>;

export type PublishDeps = {
  api: InstagramApi;
  /** Public URL for a file path inside the post folder, e.g. "media/01.jpg" */
  mediaUrl: (file: string) => string;
  /** Persists publish progress into post.json so a crashed run can resume */
  saveState: (state: InstagramState) => void;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  // Meta suggests checking status about once a minute for up to 5 minutes; images are usually ready
  // on the first check, so we poll faster and keep the 5-minute ceiling
  poll?: { intervalMs: number; timeoutMs: number };
};

export type PublishResult = { mediaId?: string; permalink?: string; resumed: boolean };

/** Approved posts whose time has come, oldest first, at most `max` */
export function selectDue(posts: Post[], now: Date, max: number): Post[] {
  return posts
    .filter((p) => p.approved && Date.parse(p.scheduledAt) <= now.getTime())
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id.localeCompare(b.id))
    .slice(0, max);
}

export async function publishPost(post: Post, deps: PublishDeps): Promise<PublishResult> {
  const { api } = deps;
  let state: InstagramState = { ...post.instagram };

  // Already published by an earlier run that crashed before moving the folder
  if (state.mediaId) return { mediaId: state.mediaId, permalink: state.permalink, resumed: true };

  let containerId = state.containerId;
  if (containerId) {
    const { status } = await api.containerStatus(containerId);
    if (status === 'PUBLISHED') {
      // media_publish succeeded but we never got to record its ID; never publish again
      return { resumed: true };
    }
    if (status === 'IN_PROGRESS') await waitUntilFinished(api, containerId, deps);
    // EXPIRED or ERROR: the old container is unusable, start over
    if (status === 'EXPIRED' || status === 'ERROR') containerId = undefined;
  }

  if (!containerId) {
    containerId = await createContainer(post, deps);
    state = { containerId };
    deps.saveState(state);
    await waitUntilFinished(api, containerId, deps);
  }

  const mediaId = await api.publish(containerId);
  state = { containerId, mediaId, publishedAt: deps.now().toISOString() };
  deps.saveState(state);

  // The post is live at this point; a missing permalink is not worth failing the run over
  const permalink = await api.permalink(mediaId).catch(() => undefined);
  if (permalink) deps.saveState({ ...state, permalink });
  return { mediaId, permalink, resumed: false };
}

async function createContainer(post: Post, deps: PublishDeps): Promise<string> {
  const { api, mediaUrl } = deps;
  const caption = fullCaption(post);

  switch (post.media.type) {
    case 'image':
      return api.createImage({ imageUrl: mediaUrl(post.media.file), caption, altText: post.altText });
    case 'carousel': {
      const children: string[] = [];
      for (const file of post.media.files) {
        const child = await api.createImage({ imageUrl: mediaUrl(file), carouselItem: true });
        await waitUntilFinished(api, child, deps);
        children.push(child);
      }
      return api.createCarousel({ children, caption });
    }
    case 'reel':
      return api.createReel({
        videoUrl: mediaUrl(post.media.video),
        coverUrl: post.media.cover ? mediaUrl(post.media.cover) : undefined,
        caption,
        shareToFeed: post.media.shareToFeed,
      });
  }
}

export async function waitUntilFinished(api: InstagramApi, containerId: string, deps: PublishDeps): Promise<void> {
  const { intervalMs, timeoutMs } = deps.poll ?? { intervalMs: 15_000, timeoutMs: 5 * 60_000 };
  const deadline = deps.now().getTime() + timeoutMs;

  for (;;) {
    const { status, detail } = await api.containerStatus(containerId);
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`container ${containerId} ${status}${detail ? `: ${detail}` : ''}`);
    }
    if (status === 'PUBLISHED') throw new Error(`container ${containerId} is already published`);
    if (deps.now().getTime() >= deadline) {
      throw new Error(`container ${containerId} still ${status} after ${Math.round(timeoutMs / 1000)}s`);
    }
    await deps.sleep(intervalMs);
  }
}
