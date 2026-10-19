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

  const handleVote = useCallback(async (target: Costume) => {
    if (!canVote) {
      const now = new Date();
      if (now < VOTE_START) {
        toast.error('Voting will start on October 30, 2026! 🎃');
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
      toast.success('Your vote has been cast! 🔥');
    }
  }, [currentUser.uid, userVotes, canVote]);

  const VotingStatus = () => {
    const now = new Date();

    if (now < VOTE_START) {
      return (
        <div className="text-center mb-8 p-4 bg-blue-900/50 rounded-lg border border-blue-700">
          <h3 className="text-xl font-creepster text-blue-400">Voting Starts Soon!</h3>
          <p className="text-gray-300 mt-2">
            Voting opens on October 30, 2026 — one vote in each of the 3 categories 🏆
          </p>
        </div>
      );
    } else if (now > VOTE_END) {
      return (
        <div className="text-center mb-8 p-4 bg-purple-900/50 rounded-lg border border-purple-700">
          <h3 className="text-xl font-creepster text-purple-400">Voting Has Ended!</h3>
          <p className="text-gray-300 mt-2">
            Thank you for participating in the Halloween Challenge! 🎉
          </p>
        </div>
      );
    }
    return (
      <div className="text-center mb-8 p-4 bg-green-900/50 rounded-lg border border-green-700">
        <h3 className="text-xl font-creepster text-green-400">Voting is Live! 🎃</h3>
        <p className="text-gray-300 mt-2">
          Cast your vote now — one vote per category! Voting ends October 30 at 23:59
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
          <h2 className="text-4xl font-creepster text-yellow-400">The Crypt is Empty!</h2>
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryPage;
