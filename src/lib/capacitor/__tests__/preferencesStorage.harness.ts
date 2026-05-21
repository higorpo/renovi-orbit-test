import { vi } from 'vitest'

const preferencesTestHarness = vi.hoisted(() => {
  const store: Record<string, string> = {}
  return {
    store,
    clear: () => {
      for (const key of Object.keys(store)) {
        delete store[key]
      }
    },
  }
})

vi.mock('@/lib/capacitor/preferencesStorage', async (importOriginal) => {
  const original = await importOriginal<typeof import('../preferencesStorage')>()
  return {
    ...original,
    preferencesGet: vi.fn(async (key: string) => preferencesTestHarness.store[key] ?? null),
    preferencesSet: vi.fn(async (key: string, value: string) => {
      preferencesTestHarness.store[key] = value
    }),
    preferencesRemove: vi.fn(async (key: string) => {
      delete preferencesTestHarness.store[key]
    }),
    preferencesClear: vi.fn(async () => {
      preferencesTestHarness.clear()
    }),
  }
})

export function clearPreferencesTestStore(): void {
  preferencesTestHarness.clear()
}

export function getPreferencesTestStore(): Record<string, string> {
  return preferencesTestHarness.store
}
