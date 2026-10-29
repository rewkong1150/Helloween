export interface Ranked<T> {
  entry: T;
  // Standard competition ranking: 1, 1, 3 (two entries tied for first, the next one is third).
  rank: number;
  tied: boolean;
}

// Ranks entries by vote count, highest first. Entries with the same count share a rank.
export const rankByVotes = <T extends { voteCount?: number }>(items: T[]): Ranked<T>[] => {
  const sorted = [...items].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  let rank = 0;
  const ranked = sorted.map((entry, i) => {
    if (i === 0 || (entry.voteCount ?? 0) !== (sorted[i - 1].voteCount ?? 0)) rank = i + 1;
    return { entry, rank };
  });
  return ranked.map((r) => ({ ...r, tied: ranked.filter((x) => x.rank === r.rank).length > 1 }));
};
