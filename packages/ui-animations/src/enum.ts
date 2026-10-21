/**
 * Map a raw value onto one member of `members`: an exact match after
 * trimming and lowercasing, then a known synonym, then the closest member by
 * edit distance (two edits at most, so `ambeint` becomes `ambient` but `zoom`
 * is not forced onto anything), else `undefined` so the caller can pick a
 * default that fits the context.
 */
export function nearestMember<T extends string>(
  value: unknown,
  members: readonly T[],
  synonyms: Readonly<Record<string, T>> = {}
): T | undefined {
  if (typeof value !== "string") {
    return;
  }
  const raw = value.trim().toLowerCase();
  const exact = members.find((member) => member === raw);
  if (exact) {
    return exact;
  }
  const synonym = synonyms[raw.replace(/[\s_]+/g, "-")];
  if (synonym) {
    return synonym;
  }
  let best: T | undefined;
  let bestDistance = MAX_EDITS + 1;
  for (const member of members) {
    const distance = editDistance(raw, member);
    if (distance < bestDistance) {
      best = member;
      bestDistance = distance;
    }
  }
  return best;
}

const MAX_EDITS = 2;

/** Levenshtein distance between two short strings. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution =
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(
        Math.min(
          (previous[j] ?? 0) + 1,
          (current[j - 1] ?? 0) + 1,
          substitution
        )
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
