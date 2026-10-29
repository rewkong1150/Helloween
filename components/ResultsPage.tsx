import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { rowToCostume, type EntryRow } from '../services/entries';
import { rankByVotes, type Ranked } from '../services/ranking';
import type { Costume, Category } from '../types';
import { CATEGORIES, getCategoryInfo, RESULTS_AT } from '../config';
import { Crown, Ghost } from 'lucide-react';

// Development-only preview with made-up data (?mockresults). Stripped from production builds.
const MOCK = import.meta.env.DEV && new URLSearchParams(window.location.search).has('mockresults');
const mockEntry = (id: string, category: Category, name: string, by: string, votes: number): Costume => ({
  id,
  userId: id,
  userName: by,
  userPhoto: '',
  uploaderName: by,
  mediaUrl: `https://picsum.photos/seed/${id}/300/300`,
  mediaPath: '',
  mediaType: 'image',
  costumeName: name,
  position: '',
  description: '',
  category,
  uploadedAt: '',
  voteCount: votes,
});
const MOCK_ENTRIES: Costume[] = [
  mockEntry('c1', 'costume', 'Vampire Queen', 'Nok', 5),
  mockEntry('c2', 'costume', 'Mummy Dad', 'Boss', 5),
  mockEntry('c3', 'costume', 'Witch Hat', 'Mint', 2),
  mockEntry('d1', 'decoration', 'Haunted Desk', 'Ploy', 4),
  mockEntry('d2', 'decoration', 'Spider Corner', 'Ton', 2),
  mockEntry('d3', 'decoration', 'Pumpkin Wall', 'Aom', 1),
  mockEntry('d4', 'decoration', 'Candle Shelf', 'Max', 0),
  mockEntry('p1', 'pet', 'Mochi the Cat', 'Fern', 0),
];

const Media: React.FC<{ costume: Costume; className: string }> = ({ costume, className }) =>
  costume.mediaType === 'video' && !costume.thumbUrl ? (
    <video src={costume.mediaUrl} preload="metadata" muted className={className} />
  ) : (
    <img src={costume.thumbUrl ?? costume.mediaUrl} alt={costume.costumeName} loading="lazy" decoding="async" className={className} />
  );

const podiumStyles = [
  { height: 'h-64', color: 'bg-yellow-400', textColor: 'text-yellow-400', borderColor: 'border-yellow-400', emoji: '🥇' },
  { height: 'h-56', color: 'bg-gray-300', textColor: 'text-gray-300', borderColor: 'border-gray-300', emoji: '🥈' },
  { height: 'h-48', color: 'bg-yellow-600', textColor: 'text-yellow-600', borderColor: 'border-yellow-600', emoji: '🥉' },
];

const TieBadge: React.FC = () => (
  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-800/70 border border-purple-400/60 text-purple-100">
    เสมอ / Tie
  </span>
);

const PodiumItem: React.FC<{ item: Ranked<Costume> }> = ({ item }) => {
  const { entry: costume, rank, tied } = item;
  const style = podiumStyles[rank - 1];
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Media costume={costume} className={`w-32 h-32 rounded-full object-cover border-4 ${style.borderColor} shadow-lg`} />
        <div className="absolute -top-4 -left-4 text-4xl transform -rotate-12">{style.emoji}</div>
      </div>
      <div className="text-center mt-2">
        <p className="font-bold text-white truncate w-36">{costume.costumeName}</p>
        <p className={`text-sm ${style.textColor}`}>{costume.uploaderName || costume.userName}</p>
        {tied && <TieBadge />}
      </div>
      <div className={`flex items-center justify-center w-full mt-2 rounded-t-lg ${style.color} ${style.height}`}>
        <span className="text-4xl font-bold text-black">{costume.voteCount ?? 0}</span>
      </div>
    </div>
  );
};

const LeaderboardItem: React.FC<{ item: Ranked<Costume>; totalVotes: number; hideRank?: boolean }> = ({ item, totalVotes, hideRank }) => {
  const { entry: costume, rank, tied } = item;
  const percentage = totalVotes > 0 ? ((costume.voteCount ?? 0) / totalVotes) * 100 : 0;
  return (
    <div className="flex items-center p-4 bg-purple-900/30 rounded-lg mb-3 transition-all hover:bg-purple-900/50">
      <span className="text-2xl font-bold text-orange-400 w-12 text-center">{hideRank ? '–' : rank}</span>
      <Media costume={costume} className="w-16 h-16 rounded-md object-cover mx-4" />
      <div className="flex-grow">
        <p className="font-semibold text-white">
          {costume.costumeName} {tied && <TieBadge />}
        </p>
        <p className="text-sm text-gray-400">by {costume.uploaderName || costume.userName}</p>
        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
      <span className="text-xl font-bold text-yellow-400 w-20 text-right">{costume.voteCount ?? 0} votes</span>
    </div>
  );
};

// One self-contained result block per category: its own podium, ranking and vote total.
const CategorySection: React.FC<{ category: Category; costumes: Costume[] }> = ({ category, costumes }) => {
  const info = getCategoryInfo(category);
  const ranked = rankByVotes(costumes);
  const totalVotes = costumes.reduce((sum, c) => sum + (c.voteCount ?? 0), 0);
  const winners = ranked.filter((r) => r.rank <= 3);
  const rest = ranked.filter((r) => r.rank > 3);
  // Classic 2nd-1st-3rd podium only when there are exactly three distinct places.
  const classic = winners.length === 3 && winners.every((w, i) => w.rank === i + 1);
  const podium = classic ? [winners[1], winners[0], winners[2]] : winners;

  return (
    <section id={`results-${category}`} className="mb-16 scroll-mt-24">
      <div className="text-center mb-6">
        <h2 className="font-display text-3xl md:text-4xl text-orange-400">
          {info.emoji} {info.label}
        </h2>
        <p className="text-yellow-400 mt-1">{info.labelTh}</p>
        <p className="text-sm text-gray-400 mt-1">
          {costumes.length} ผลงาน · {totalVotes} โหวต / {costumes.length} entries · {totalVotes} votes
        </p>
      </div>

      {costumes.length === 0 ? (
        <div className="text-center py-10 bg-black/30 rounded-xl">
          <Ghost className="mx-auto h-16 w-16 text-purple-400" />
          <p className="mt-3 text-gray-300">ยังไม่มีผลงานในหมวดนี้ / No entries in this category</p>
        </div>
      ) : totalVotes === 0 ? (
        <div className="bg-black/30 rounded-xl p-4">
          <p className="text-center text-gray-300 mb-4">ยังไม่มีผู้โหวตในหมวดนี้ จึงยังไม่ประกาศผู้ชนะ / No votes yet, so no winner</p>
          {ranked.map((item) => (
            <LeaderboardItem key={item.entry.id} item={{ ...item, tied: false }} totalVotes={0} hideRank />
          ))}
        </div>
      ) : (
        <>
          <div className="flex justify-center items-end gap-4 md:gap-8 mb-10 p-4 bg-black/30 rounded-xl flex-wrap">
            {podium.map((item) => (
              <PodiumItem key={item.entry.id} item={item} />
            ))}
          </div>
          {rest.map((item) => (
            <LeaderboardItem key={item.entry.id} item={item} totalVotes={totalVotes} />
          ))}
        </>
      )}
    </section>
  );
};

// ResultsPage with countdown
const ResultsPage: React.FC = () => {
  const [costumes, setCostumes] = useState<Costume[]>(MOCK ? MOCK_ENTRIES : []);
  const [loading, setLoading] = useState(!MOCK);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const diff = RESULTS_AT.getTime() - Date.now();
      setTimeLeft(MOCK || diff <= 0 ? 0 : diff);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  // Totals are only released by the server once results open.
  useEffect(() => {
    if (MOCK || timeLeft > 0) return;
    let cancelled = false;
    (async () => {
      const [entriesRes, resultsRes] = await Promise.all([
        supabase.from('entries').select('*'),
        supabase.rpc('get_results'),
      ]);
      if (entriesRes.error || resultsRes.error) {
        console.error('Error fetching results:', entriesRes.error ?? resultsRes.error);
      }
      const counts = new Map<string, number>(
        ((resultsRes.data ?? []) as { entry_id: string; vote_count: number }[]).map((r) => [r.entry_id, Number(r.vote_count)])
      );
      const list = ((entriesRes.data ?? []) as EntryRow[]).map((row) => rowToCostume(row, counts.get(row.id) ?? 0));
      if (!cancelled) {
        setCostumes(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [timeLeft > 0]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${days} Day ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  };

  if (timeLeft > 0) {
    return (
      <div className="text-center py-20">
        <Ghost className="mx-auto h-24 w-24 text-purple-400 animate-bounce" />
        <h2 className="text-4xl font-display text-yellow-400 mt-4">Announcement of results in:</h2>
        <p className="mt-4 text-5xl font-bold text-orange-500">{formatTime(timeLeft)}</p>
        <p className="mt-2 text-lg text-gray-300">Results will be announced after voting closes on October 30, 2026 🎃</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center text-2xl font-display text-orange-500 animate-pulse">กำลังคำนวณผลการแข่งขัน...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-5xl md:text-6xl text-center text-orange-500 mb-6 flex items-center justify-center gap-4">
        <Crown className="w-10 h-10 md:w-12 md:h-12 text-yellow-400" />
        Hall of Fame
        <Crown className="w-10 h-10 md:w-12 md:h-12 text-yellow-400" />
      </h1>

      {/* Jump links: every category is announced on this page, each in its own section */}
      <div className="flex flex-wrap justify-center gap-2 mb-12">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => document.getElementById(`results-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-4 py-2 rounded-full font-semibold border border-purple-600 bg-purple-900/40 text-gray-200 hover:border-orange-400 transition-all"
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {CATEGORIES.map((c) => (
        <CategorySection key={c.id} category={c.id} costumes={costumes.filter((e) => e.category === c.id)} />
      ))}
    </div>
  );
};

export default ResultsPage;
