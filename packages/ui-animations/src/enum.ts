/**
 * Map a raw value onto one member of `members`: an exact match after
 * trimming and lowercasing, then a known synonym, then the closest member by
 * edit distance, else `undefined` so the caller can pick a default that fits
 * the context. Short members allow fewer edits: one edit turns `edit` into
 * `exit`, so words of four letters or fewer must match exactly, up to six
 * may be one edit off, and longer ones two (`ambeint` becomes `ambient`).
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
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const member of members) {
    const distance = editDistance(raw, member);
    if (distance <= maxEdits(member) && distance < bestDistance) {
      best = member;
      bestDistance = distance;
    }
  }
  return best;
}

function maxEdits(member: string): number {
  if (member.length <= 4) {
    return 0;
  }
  return member.length <= 6 ? 1 : 2;
}

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
