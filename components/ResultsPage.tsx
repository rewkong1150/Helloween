import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { rowToCostume, type EntryRow } from '../services/entries';
import type { Costume, Category } from '../types';
import { CATEGORIES, getCategoryInfo, RESULTS_AT } from '../config';
import { Crown, Ghost } from 'lucide-react';

const Media: React.FC<{ costume: Costume; className: string }> = ({ costume, className }) =>
  costume.mediaType === 'video' && !costume.thumbUrl ? (
    <video src={costume.mediaUrl} preload="metadata" muted className={className} />
  ) : (
    <img src={costume.thumbUrl ?? costume.mediaUrl} alt={costume.costumeName} loading="lazy" decoding="async" className={className} />
  );

// PodiumItem
const PodiumItem: React.FC<{ costume: Costume; rank: number }> = ({ costume, rank }) => {
  const podiumStyles = [
    { height: 'h-64', color: 'bg-yellow-400', textColor: 'text-yellow-400', borderColor: 'border-yellow-400', emoji: '🥇' },
    { height: 'h-56', color: 'bg-gray-300', textColor: 'text-gray-300', borderColor: 'border-gray-300', emoji: '🥈' },
    { height: 'h-48', color: 'bg-yellow-600', textColor: 'text-yellow-600', borderColor: 'border-yellow-600', emoji: '🥉' },
  ];
  const style = podiumStyles[rank - 1];

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Media costume={costume} className={`w-32 h-32 rounded-full object-cover border-4 ${style.borderColor} shadow-lg`} />
        <div className={`absolute -top-4 -left-4 text-4xl transform -rotate-12`}>{style.emoji}</div>
      </div>
      <div className="text-center mt-2">
        <p className="font-bold text-white truncate w-36">{costume.costumeName}</p>
        <p className={`text-sm ${style.textColor}`}>{costume.uploaderName || costume.userName}</p>
      </div>
      <div className={`flex items-center justify-center w-full mt-2 rounded-t-lg ${style.color} ${style.height}`}>
        <span className="text-4xl font-bold text-black">{costume.voteCount ?? 0}</span>
      </div>
    </div>
  );
};

// LeaderboardItem
const LeaderboardItem: React.FC<{ costume: Costume; rank: number; totalVotes: number }> = ({ costume, rank, totalVotes }) => {
  const percentage = totalVotes > 0 ? ((costume.voteCount ?? 0) / totalVotes) * 100 : 0;
  return (
    <div className="flex items-center p-4 bg-purple-900/30 rounded-lg mb-3 transition-all hover:bg-purple-900/50">
      <span className="text-2xl font-bold text-orange-400 w-12 text-center">{rank}</span>
      <Media costume={costume} className="w-16 h-16 rounded-md object-cover mx-4" />
      <div className="flex-grow">
        <p className="font-semibold text-white">{costume.costumeName}</p>
        <p className="text-sm text-gray-400">by {costume.uploaderName || costume.userName}</p>
        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
      <span className="text-xl font-bold text-yellow-400 w-20 text-right">{costume.voteCount ?? 0} votes</span>
    </div>
  );
};

// ResultsPage with countdown
const ResultsPage: React.FC = () => {
  const [costumes, setCostumes] = useState<Costume[]>([]);
  const [category, setCategory] = useState<Category>('costume');
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const updateCountdown = () => {
      const diff = RESULTS_AT.getTime() - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  // Totals are only released by the server once results open.
  useEffect(() => {
    if (timeLeft > 0) return;
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
      const list = ((entriesRes.data ?? []) as EntryRow[])
        .map((row) => rowToCostume(row, counts.get(row.id) ?? 0))
        .sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
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

  const inCategory = costumes.filter((c) => c.category === category);
  const totalVotes = inCategory.reduce((sum, costume) => sum + (costume.voteCount ?? 0), 0);
  const topThree = inCategory.slice(0, 3);
  const rest = inCategory.slice(3);
  const categoryInfo = getCategoryInfo(category);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-6xl text-center text-orange-500 mb-8 flex items-center justify-center gap-4">
        <Crown className="w-12 h-12 text-yellow-400"/>
        Hall of Fame
        <Crown className="w-12 h-12 text-yellow-400"/>
      </h1>

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-4 py-2 rounded-full font-semibold border transition-all ${
              category === c.id
                ? 'bg-gradient-to-r from-orange-500 to-yellow-500 border-transparent text-white'
                : 'border-purple-600 bg-purple-900/40 text-gray-200 hover:border-orange-400'
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {inCategory.length === 0 ? (
        <div className="text-center py-20">
          <Ghost className="mx-auto h-24 w-24 text-purple-400" />
          <h2 className="text-4xl font-display text-yellow-400 mt-4">ยังไม่มีผลโหวต</h2>
          <p className="mt-4 text-lg text-gray-300">ยังไม่มีผลงานในหมวด “{categoryInfo.labelTh}”</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center items-end gap-4 md:gap-8 mb-12 p-4 bg-black/30 rounded-xl">
            {topThree[1] && <PodiumItem costume={topThree[1]} rank={2} />}
            {topThree[0] && <PodiumItem costume={topThree[0]} rank={1} />}
            {topThree[2] && <PodiumItem costume={topThree[2]} rank={3} />}
          </div>

          {rest.length > 0 && (
            <div>
              {rest.map((costume, index) => (
                <LeaderboardItem key={costume.id} costume={costume} rank={index + 4} totalVotes={totalVotes} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsPage;
