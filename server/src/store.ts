import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import type { Platform, PostRecord, StoreShape, StoredConnection } from "./types.js";

const emptyStore: StoreShape = { posts: [], connections: [] };
let writeQueue: Promise<void> = Promise.resolve();

async function ensureStore() {
  await mkdir(path.dirname(config.dataFile), { recursive: true });
  try {
    await readFile(config.dataFile, "utf8");
  } catch {
    await writeFile(config.dataFile, JSON.stringify(emptyStore, null, 2), "utf8");
  }
}

export async function readStore(): Promise<StoreShape> {
  await ensureStore();
  try {
    const value = JSON.parse(await readFile(config.dataFile, "utf8")) as StoreShape;
    return {
      posts: Array.isArray(value.posts) ? value.posts : [],
      connections: Array.isArray(value.connections) ? value.connections : []
    };
  } catch {
    return structuredClone(emptyStore);
  }
}

async function writeStore(next: StoreShape) {
  const temp = `${config.dataFile}.tmp`;
  await writeFile(temp, JSON.stringify(next, null, 2), "utf8");
  await rename(temp, config.dataFile);
}

export async function updateStore(mutator: (store: StoreShape) => void | Promise<void>) {
  let result: StoreShape | undefined;
  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    await mutator(store);
    await writeStore(store);
    result = store;
  });
  await writeQueue;
  return result!;
}

export async function listPosts() {
  const store = await readStore();
  return store.posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPost(id: string) {
  return (await readStore()).posts.find((post) => post.id === id);
}

export async function savePost(post: PostRecord) {
  await updateStore((store) => {
    const index = store.posts.findIndex((item) => item.id === post.id);
    if (index === -1) store.posts.push(post);
    else store.posts[index] = post;
  });
  return post;
}

export async function removePost(id: string) {
  let removed: PostRecord | undefined;
  await updateStore((store) => {
    const index = store.posts.findIndex((item) => item.id === id);
    if (index >= 0) removed = store.posts.splice(index, 1)[0];
  });
  return removed;
}

export async function getConnection(platform: Platform) {
  return (await readStore()).connections.find((item) => item.platform === platform && item.connected);
}

export async function saveConnection(connection: StoredConnection) {
  await updateStore((store) => {
    store.connections = store.connections.filter((item) => item.platform !== connection.platform);
    store.connections.push(connection);
  });
  return connection;
}

export async function removeConnection(platform: Platform) {
  await updateStore((store) => {
    store.connections = store.connections.filter((item) => item.platform !== platform);
  });
}

