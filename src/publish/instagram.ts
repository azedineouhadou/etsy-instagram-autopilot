// Instagram API with Instagram Login (graph.instagram.com). Endpoint and field names follow
// developers.facebook.com/docs/instagram-platform/content-publishing (checked 2026-10-17).

export type ContainerStatus = 'FINISHED' | 'IN_PROGRESS' | 'ERROR' | 'EXPIRED' | 'PUBLISHED';

export interface InstagramApi {
  createImage(p: { imageUrl: string; caption?: string; altText?: string; carouselItem?: boolean }): Promise<string>;
  createCarousel(p: { children: string[]; caption: string }): Promise<string>;
  createReel(p: { videoUrl: string; coverUrl?: string; caption: string; shareToFeed: boolean }): Promise<string>;
  containerStatus(containerId: string): Promise<{ status: ContainerStatus; detail?: string }>;
  publish(containerId: string): Promise<string>;
  permalink(mediaId: string): Promise<string | undefined>;
  quota(): Promise<{ used: number; total: number }>;
}

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'InstagramApiError';
  }
}

type Params = Record<string, string | undefined>;

export class InstagramClient implements InstagramApi {
  private readonly base: string;

  constructor(
    private readonly opts: { userId: string; accessToken: string; apiVersion: string; fetch?: typeof fetch },
  ) {
    // A malformed version (e.g. "v25.0.") gets misread by the API as an object ID, which hides the real cause
    if (!/^v\d+\.\d+$/.test(opts.apiVersion)) {
      throw new InstagramApiError(`INSTAGRAM_API_VERSION must look like v25.0 (got "${opts.apiVersion}")`, 0);
    }
    this.base = `https://graph.instagram.com/${opts.apiVersion}`;
  }

  async createImage(p: { imageUrl: string; caption?: string; altText?: string; carouselItem?: boolean }) {
    const res = await this.post(`/${this.opts.userId}/media`, {
      image_url: p.imageUrl,
      caption: p.caption,
      alt_text: p.altText,
      is_carousel_item: p.carouselItem ? 'true' : undefined,
    });
    return this.id(res);
  }

  async createCarousel(p: { children: string[]; caption: string }) {
    const res = await this.post(`/${this.opts.userId}/media`, {
      media_type: 'CAROUSEL',
      children: p.children.join(','),
      caption: p.caption,
    });
    return this.id(res);
  }

  async createReel(p: { videoUrl: string; coverUrl?: string; caption: string; shareToFeed: boolean }) {
    const res = await this.post(`/${this.opts.userId}/media`, {
      media_type: 'REELS',
      video_url: p.videoUrl,
      cover_url: p.coverUrl,
      caption: p.caption,
      share_to_feed: String(p.shareToFeed),
    });
    return this.id(res);
  }

  async containerStatus(containerId: string) {
    const res = await this.get(`/${containerId}`, { fields: 'status_code,status' });
    return { status: res.status_code as ContainerStatus, detail: typeof res.status === 'string' ? res.status : undefined };
  }

  async publish(containerId: string) {
    return this.id(await this.post(`/${this.opts.userId}/media_publish`, { creation_id: containerId }));
  }

  async permalink(mediaId: string) {
    const res = await this.get(`/${mediaId}`, { fields: 'permalink' });
    return typeof res.permalink === 'string' ? res.permalink : undefined;
  }

  /** Who the token belongs to; `user_id` is the ID the publishing endpoints expect */
  async me() {
    const res = await this.get('/me', { fields: 'user_id,username,account_type' });
    return { userId: String(res.user_id ?? ''), username: String(res.username ?? ''), accountType: String(res.account_type ?? '') };
  }

  async quota() {
    const res = await this.get(`/${this.opts.userId}/content_publishing_limit`, { fields: 'quota_usage,config' });
    const row = (res.data as { quota_usage?: number; config?: { quota_total?: number } }[] | undefined)?.[0];
    return { used: row?.quota_usage ?? 0, total: row?.config?.quota_total ?? 50 };
  }

  private id(res: Record<string, unknown>): string {
    if (typeof res.id !== 'string') throw new InstagramApiError('response had no id', 200);
    return res.id;
  }

  private get(path: string, params: Params) {
    const query = this.encode({ ...params, access_token: this.opts.accessToken });
    return this.send(path, `${this.base}${path}?${query}`, { method: 'GET' });
  }

  private post(path: string, params: Params) {
    return this.send(path, `${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: this.encode({ ...params, access_token: this.opts.accessToken }),
    });
  }

  // `path` (never the full URL) goes into errors so the token can't leak into logs
  private async send(path: string, url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await (this.opts.fetch ?? fetch)(url, init);
    } catch (err) {
      throw new InstagramApiError(`${init.method} ${path}: network error (${(err as Error).name})`, 0);
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || body.error) {
      const err = body.error as { message?: string; code?: number } | undefined;
      throw new InstagramApiError(`${init.method} ${path}: ${err?.message ?? `HTTP ${res.status}`}`, res.status, err?.code);
    }
    return body;
  }

  private encode(params: Params): string {
    const clean = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined);
    return new URLSearchParams(clean).toString();
  }
}

/** Stands in for Instagram during dry runs: records each call and pretends it succeeded */
export class DryRunInstagram implements InstagramApi {
  readonly calls: string[] = [];
  private n = 0;

  private fake(kind: string, line: string) {
    this.calls.push(line);
    return `dry-${kind}-${++this.n}`;
  }

  async createImage(p: { imageUrl: string; caption?: string; altText?: string; carouselItem?: boolean }) {
    const what = p.carouselItem ? 'carousel item' : 'image';
    return this.fake('container', `create ${what}  ${p.imageUrl}${p.caption ? `  caption: ${preview(p.caption)}` : ''}`);
  }
  async createCarousel(p: { children: string[]; caption: string }) {
    return this.fake('container', `create carousel  ${p.children.length} items  caption: ${preview(p.caption)}`);
  }
  async createReel(p: { videoUrl: string; coverUrl?: string; caption: string; shareToFeed: boolean }) {
    return this.fake(
      'container',
      `create reel  ${p.videoUrl}  cover: ${p.coverUrl ?? '-'}  share_to_feed: ${p.shareToFeed}  caption: ${preview(p.caption)}`,
    );
  }
  async containerStatus(containerId: string) {
    this.calls.push(`status ${containerId} → FINISHED`);
    return { status: 'FINISHED' as const };
  }
  async publish(containerId: string) {
    return this.fake('media', `publish ${containerId}`);
  }
  async permalink() {
    return undefined;
  }
  async quota() {
    return { used: 0, total: 50 };
  }
}

function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return JSON.stringify(flat.length > 50 ? `${flat.slice(0, 50)}…` : flat);
}
