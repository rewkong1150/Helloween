import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { rowToCostume, type EntryRow } from '../services/entries';
import type { AppUser, Costume, Category } from '../types';
import { CATEGORIES, getCategoryInfo, VOTE_START, VOTE_END } from '../config';
import CostumeCard from './CostumeCard';
import { toast } from './Toast';

interface GalleryPageProps {
  currentUser: AppUser;
}

const SkeletonCard: React.FC = () => (
  <div className="bg-gray-900/50 p-4 rounded-lg animate-pulse">
    <div className="w-full h-64 bg-gray-700 rounded-md mb-4"></div>
    <div className="flex items-center mb-2">
      <div className="w-8 h-8 rounded-full bg-gray-700 mr-2"></div>
      <div className="w-3/4 h-4 bg-gray-700 rounded"></div>
    </div>
    <div className="w-1/2 h-5 bg-gray-700 rounded mb-2"></div>
    <div className="w-full h-3 bg-gray-700 rounded mb-1"></div>
    <div className="w-5/6 h-3 bg-gray-700 rounded"></div>
  </div>
);

const GalleryPage: React.FC<GalleryPageProps> = ({ currentUser }) => {
  const [costumes, setCostumes] = useState<Costume[]>([]);
  const [category, setCategory] = useState<Category>('costume');
  // The entry the current user voted for, per category.
  const [userVotes, setUserVotes] = useState<Partial<Record<Category, string>>>({});
  const [loading, setLoading] = useState(true);
  const [canVote, setCanVote] = useState(false);
  // Vote the user is about to switch to (asks for confirmation first).
  const [pendingChange, setPendingChange] = useState<Costume | null>(null);

  const checkVotingPeriod = useCallback(() => {
    const now = new Date();
    return now >= VOTE_START && now <= VOTE_END;
  }, []);

  useEffect(() => {
    setCanVote(checkVotingPeriod());
    const interval = setInterval(() => setCanVote(checkVotingPeriod()), 60000);
    return () => clearInterval(interval);
  }, [checkVotingPeriod]);

  const loadEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching entries:', error);
      toast.error('Could not load entries.');
    } else {
      setCostumes((data as EntryRow[]).map((row) => rowToCostume(row)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
    const channel = supabase
      .channel('entries-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => loadEntries())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadEntries]);

  const loadVotes = useCallback(async () => {
    const { data, error } = await supabase.from('votes').select('category, entry_id');
    if (error) {
      console.error('Error fetching votes:', error);
      return;
    }
    const votes: Partial<Record<Category, string>> = {};
    (data ?? []).forEach((v) => {
      votes[v.category as Category] = v.entry_id as string;
    });
    setUserVotes(votes);
  }, []);

  useEffect(() => {
    loadVotes();
  }, [loadVotes, currentUser.uid]);

  const castVote = useCallback(async (target: Costume) => {
    const previous = userVotes[target.category];

    // Optimistic UI update
    setUserVotes((prev) => ({ ...prev, [target.category]: target.id }));

    const { error } = await supabase.rpc('cast_vote', { p_entry: target.id });
    if (error) {
      console.error('Error voting:', error);
      toast.error(error.message || 'Failed to cast vote. Please try again.');
      setUserVotes((prev) => {
        const next = { ...prev };
        if (previous) next[target.category] = previous;
        else delete next[target.category];
        return next;
      });
    } else {
      toast.success(previous ? 'Your vote has been changed! 🔄' : 'Your vote has been cast! 🔥');
    }
  }, [userVotes]);

  const handleVote = useCallback((target: Costume) => {
    if (!canVote) {
      const now = new Date();
      if (now < VOTE_START) {
        toast.error('Voting will start on October 30, 2026 at 18:00! 🎃');
      } else if (now > VOTE_END) {
        toast.error('Voting period has ended! Thank you for participating! 👻');
      }
      return;
    }

    if (currentUser.uid === target.userId) {
      toast.error('You cannot vote for yourself! 🎃');
      return;
    }

    const previous = userVotes[target.category];
    if (previous === target.id) return;

    // One vote per category: voting for someone else replaces the old vote, so ask first.
    if (previous) {
      setPendingChange(target);
      return;
    }
    castVote(target);
  }, [currentUser.uid, userVotes, canVote, castVote]);

  const confirmChange = () => {
    if (pendingChange) castVote(pendingChange);
    setPendingChange(null);
  };


  const VotingStatus = () => {
    const now = new Date();

    if (now < VOTE_START) {
      return (
        <div className="text-center mb-8 p-4 bg-orange-900/40 rounded-lg border border-orange-700">
          <h3 className="text-xl font-display text-orange-400">Voting Starts Soon!</h3>
          <p className="text-gray-300 mt-2">
            Voting opens on October 30, 2026 at 18:00 — one vote in each of the 3 categories 🏆
          </p>
        </div>
      );
    } else if (now > VOTE_END) {
      return (
        <div className="text-center mb-8 p-4 bg-purple-900/50 rounded-lg border border-purple-700">
          <h3 className="text-xl font-display text-purple-400">Voting Has Ended!</h3>
          <p className="text-gray-300 mt-2">
            Thank you for participating in the Halloween Challenge! 🎉
          </p>
        </div>
      );
    }
    return (
      <div className="text-center mb-8 p-4 bg-green-900/50 rounded-lg border border-green-700">
        <h3 className="text-xl font-display text-green-400">Voting is Live! 🎃</h3>
        <p className="text-gray-300 mt-2">
          Cast your vote now — one vote per category! Voting ends October 31 at 18:00
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const visibleCostumes = costumes.filter((c) => c.category === category);
  const categoryInfo = getCategoryInfo(category);

  return (
    <div>
      <VotingStatus />

      {pendingChange && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="max-w-md w-full bg-black border border-purple-500/60 rounded-2xl p-6 shadow-2xl shadow-purple-500/20">
            <h3 className="font-display text-2xl text-orange-400 mb-3">Change your vote? / เปลี่ยนโหวตหรือไม่?</h3>
            <p className="text-gray-200">
              You already voted for <b>“{costumes.find((c) => c.id === userVotes[pendingChange.category])?.costumeName ?? 'another entry'}”</b>{' '}
              in {getCategoryInfo(pendingChange.category).label}. Switch to <b>“{pendingChange.costumeName}”</b>?
            </p>
            <p className="text-gray-300 mt-2 text-sm">
              คุณโหวตหมวดนี้ไปแล้ว ต้องการเปลี่ยนเป็น “{pendingChange.costumeName}” หรือไม่?
              (1 คนโหวตได้ 1 ครั้งต่อหมวด และเปลี่ยนได้จนกว่าจะปิดโหวต)
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPendingChange(null)}
                className="px-4 py-2 rounded-md border border-purple-600 text-gray-200 hover:bg-purple-900/60 transition-colors"
              >
                Keep my vote / ใช้โหวตเดิม
              </button>
              <button
                onClick={confirmChange}
                className="px-4 py-2 rounded-md font-semibold text-white bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 transition-all"
              >
                Change vote / เปลี่ยนโหวต
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {CATEGORIES.map((c) => {
          const count = costumes.filter((e) => e.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-4 py-2 rounded-full font-semibold border transition-all ${
                category === c.id
                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500 border-transparent text-white'
                  : 'border-purple-600 bg-purple-900/40 text-gray-200 hover:border-orange-400'
              }`}
            >
              {c.emoji} {c.label} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {visibleCostumes.length === 0 ? (
        <div className="text-center py-20">
          <h2 className="text-4xl font-display text-yellow-400">The Crypt is Empty!</h2>
          <p className="mt-4 text-lg text-gray-300">
            No entries in “{categoryInfo.label}” yet. {categoryInfo.description}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {visibleCostumes.map((costume) => (
            <CostumeCard
              key={costume.id}
              costume={costume}
              onVote={handleVote}
              isOwnCostume={currentUser.uid === costume.userId}
              isVotedFor={userVotes[category] === costume.id}
              hasVotedInCategory={!!userVotes[category]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
