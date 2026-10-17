import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { postSchema, type Post } from '../schemas/post.js';
import { productSchema, type Product } from '../schemas/product.js';

// pending = a new book with link.txt that is waiting for Claude to write product.json
export type Loaded<T> = { dir: string; folder: string; value?: T; errors: string[]; pending?: boolean };

export const PATHS = {
  products: 'assets/products',
  queue: 'queue',
  published: 'published',
} as const;

function subfolders(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function loadJson<S extends z.ZodType>(dir: string, folder: string, file: string, schema: S): Loaded<z.infer<S>> {
  const path = join(dir, file);
  if (!existsSync(path)) return { dir, folder, errors: [`missing ${file}`] };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return { dir, folder, errors: [`${file} is not valid JSON: ${(err as Error).message}`] };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      dir,
      folder,
      errors: parsed.error.issues.map((i) => `${file} ${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  return { dir, folder, value: parsed.data, errors: [] };
}

export function loadProducts(root: string): Loaded<Product>[] {
  const base = join(root, PATHS.products);
  return subfolders(base).map((folder) => {
    const dir = join(base, folder);
    if (!existsSync(join(dir, 'product.json')) && existsSync(join(dir, 'link.txt'))) {
      return { dir, folder, errors: [], pending: true };
    }
    if (!existsSync(join(dir, 'product.json'))) {
      return { dir, folder, errors: ['missing product.json — for a new book, add link.txt with its Etsy link'] };
    }
    return loadJson(dir, folder, 'product.json', productSchema);
  });
}

export function loadPosts(root: string, area: 'queue' | 'published'): Loaded<Post>[] {
  const base = join(root, PATHS[area]);
  return subfolders(base).map((folder) => loadJson(join(base, folder), folder, 'post.json', postSchema));
}
