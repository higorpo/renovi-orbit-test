import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

const mocks = vi.hoisted(() => ({
  store: { name: "query-cache-store" },
  createStore: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("idb-keyval", () => ({
  createStore: mocks.createStore,
  get: mocks.get,
  set: mocks.set,
  del: mocks.del,
}));

mocks.createStore.mockReturnValue(mocks.store);

const { createIDBPersister } = await import("../persister");

describe("createIDBPersister", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.set.mockReset();
    mocks.del.mockReset();
  });

  it("creates the dedicated query cache store", () => {
    expect(mocks.createStore).toHaveBeenCalledOnce();
    expect(mocks.createStore).toHaveBeenCalledWith("orbit-vault", "query-cache");
  });

  it("persists the React Query client in IndexedDB", async () => {
    const client = {
      timestamp: 123,
      buster: "v1",
      clientState: { mutations: [], queries: [] },
    } satisfies PersistedClient;

    await createIDBPersister().persistClient(client);

    expect(mocks.set).toHaveBeenCalledWith(
      "persisted-cache",
      client,
      mocks.store,
    );
  });

  it("restores the persisted React Query client", async () => {
    const client = {
      timestamp: 456,
      buster: "v2",
      clientState: { mutations: [], queries: [] },
    } satisfies PersistedClient;
    mocks.get.mockResolvedValue(client);

    await expect(createIDBPersister().restoreClient()).resolves.toBe(client);
    expect(mocks.get).toHaveBeenCalledWith("persisted-cache", mocks.store);
  });

  it("removes the persisted React Query client", async () => {
    await createIDBPersister().removeClient();

    expect(mocks.del).toHaveBeenCalledWith("persisted-cache", mocks.store);
  });
});
