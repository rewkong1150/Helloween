
import React, { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Costume, Vote } from '../types';
import CostumeCard from './CostumeCard';
import { toast } from './Toast';

interface GalleryPageProps {
  currentUser: User;
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
  const [userVote, setUserVote] = useState<Vote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'costumes'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const costumesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Costume));
      setCostumes(costumesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching costumes:", error);
      toast.error("Could not load costumes.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const voteRef = doc(db, 'votes', currentUser.uid);
    const unsubscribe = onSnapshot(voteRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserVote(docSnap.data() as Vote);
      } else {
        setUserVote(null);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleVote = useCallback(async (targetUserId: string) => {
    if (!currentUser) return;
    const currentUserId = currentUser.uid;

    if (currentUserId === targetUserId) {
      toast.error("You cannot vote for yourself! 🎃");
      return;
    }
    
    // Optimistic UI update
    const previousVote = userVote;
    const newVote = { voterId: currentUserId, votedFor: targetUserId, votedAt: serverTimestamp() }; // serverTimestamp is an object
    setUserVote(newVote as Vote); // Temporarily cast for UI state
    
    try {
        const voteRef = doc(db, 'votes', currentUserId);
        const oldVoteSnap = await getDoc(voteRef);

        if (oldVoteSnap.exists() && oldVoteSnap.data().votedFor !== targetUserId) {
            const oldTargetId = oldVoteSnap.data().votedFor;
            await updateDoc(doc(db, 'costumes', oldTargetId), {
                voteCount: increment(-1)
            });
        }
        
        await setDoc(voteRef, {
            voterId: currentUserId,
            votedFor: targetUserId,
            votedAt: serverTimestamp()
        });

        if (!oldVoteSnap.exists() || oldVoteSnap.data().votedFor !== targetUserId) {
             await updateDoc(doc(db, 'costumes', targetUserId), {
                voteCount: increment(1)
            });
        }

        toast.success("Your vote has been cast! 🔥");

    } catch (error) {
        console.error("Error voting:", error);
        toast.error("Failed to cast vote. Please try again.");
        // Revert optimistic update on error
        setUserVote(previousVote);
    }
  }, [currentUser, userVote]);
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (costumes.length === 0) {
      return (
          <div className="text-center py-20">
              <h2 className="text-4xl font-creepster text-yellow-400">The Crypt is Empty!</h2>
              <p className="mt-4 text-lg text-gray-300">No costumes have been uploaded yet. Be the first to show off your spooky style!</p>
          </div>
      )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {costumes.map((costume) => (
        <CostumeCard
          key={costume.id}
          costume={costume}
          onVote={handleVote}
          isOwnCostume={currentUser.uid === costume.userId}
          isVotedFor={userVote?.votedFor === costume.userId}
        />
      ))}
    </div>
  );
};

export default GalleryPage;
