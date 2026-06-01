export type KeysetIdentified = {
  id: string;
  created_at: string;
};

/**
 * Merges paginated message rows without duplicate ids (R13-AC04 reconnect gap fill).
 * Preserves ascending display order by (created_at, id).
 */
export function mergeKeysetMessagePages<T extends KeysetIdentified>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  if (incoming.length === 0) return [...existing];

  const byId = new Map<string, T>();
  for (const row of existing) {
    byId.set(row.id, row);
  }
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return sortByKeyset([...byId.values()]);
}

function sortByKeyset<T extends KeysetIdentified>(rows: T[]): T[] {
  return rows.sort((a, b) => {
    const at = Date.parse(a.created_at);
    const bt = Date.parse(b.created_at);
    if (at !== bt) return at - bt;
    return a.id.localeCompare(b.id);
  });
}
