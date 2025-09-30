
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Costume } from '../types';
import { Crown, Ghost } from 'lucide-react';

const PodiumItem: React.FC<{ costume: Costume; rank: number; totalVotes: number }> = ({ costume, rank, totalVotes }) => {
  const podiumStyles = [
    { height: 'h-64', color: 'bg-yellow-400', textColor: 'text-yellow-400', borderColor: 'border-yellow-400', emoji: '🥇' },
    { height: 'h-56', color: 'bg-gray-300', textColor: 'text-gray-300', borderColor: 'border-gray-300', emoji: '🥈' },
    { height: 'h-48', color: 'bg-yellow-600', textColor: 'text-yellow-600', borderColor: 'border-yellow-600', emoji: '🥉' },
  ];
  const style = podiumStyles[rank - 1];

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <img src={costume.costumeImage} alt={costume.costumeName} className={`w-32 h-32 rounded-full object-cover border-4 ${style.borderColor} shadow-lg`} />
        <div className={`absolute -top-4 -left-4 text-4xl transform -rotate-12`}>{style.emoji}</div>
      </div>
      <div className="text-center mt-2">
        <p className="font-bold text-white truncate w-36">{costume.costumeName}</p>
        <p className={`text-sm ${style.textColor}`}>{costume.userName}</p>
      </div>
      <div className={`flex items-center justify-center w-full mt-2 rounded-t-lg ${style.color} ${style.height}`}>
        <span className="text-4xl font-bold text-black">{costume.voteCount}</span>
      </div>
    </div>
  );
};

const LeaderboardItem: React.FC<{ costume: Costume; rank: number; totalVotes: number }> = ({ costume, rank, totalVotes }) => {
  const percentage = totalVotes > 0 ? (costume.voteCount / totalVotes) * 100 : 0;
  return (
    <div className="flex items-center p-4 bg-purple-900/30 rounded-lg mb-3 transition-all hover:bg-purple-900/50">
      <span className="text-2xl font-bold text-orange-400 w-12 text-center">{rank}</span>
      <img src={costume.costumeImage} alt={costume.costumeName} className="w-16 h-16 rounded-md object-cover mx-4" />
      <div className="flex-grow">
        <p className="font-semibold text-white">{costume.costumeName}</p>
        <p className="text-sm text-gray-400">by {costume.userName}</p>
        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
      <span className="text-xl font-bold text-yellow-400 w-20 text-right">{costume.voteCount} votes</span>
    </div>
  );
};

const ResultsPage: React.FC = () => {
  const [costumes, setCostumes] = useState<Costume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'costumes'), orderBy('voteCount', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const costumesData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Costume));
      setCostumes(costumesData);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching results:", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const totalVotes = costumes.reduce((sum, costume) => sum + costume.voteCount, 0);
  const topThree = costumes.slice(0, 3);
  const rest = costumes.slice(3);

  if (loading) {
      return <div className="text-center text-2xl font-creepster text-orange-500 animate-pulse">Calculating Winners...</div>;
  }
  
  if (costumes.length === 0) {
    return (
        <div className="text-center py-20">
            <Ghost className="mx-auto h-24 w-24 text-purple-400" />
            <h2 className="text-4xl font-creepster text-yellow-400 mt-4">The Results are Ghostly Quiet</h2>
            <p className="mt-4 text-lg text-gray-300">No votes have been cast yet. Head to the gallery to pick your favorite!</p>
        </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-creepster text-6xl text-center text-orange-500 mb-8 flex items-center justify-center gap-4">
        <Crown className="w-12 h-12 text-yellow-400"/>
        Hall of Fame
        <Crown className="w-12 h-12 text-yellow-400"/>
      </h1>

      {topThree.length > 0 && (
        <div className="flex justify-center items-end gap-4 md:gap-8 mb-12 p-4 bg-black/30 rounded-xl">
          {topThree[1] && <PodiumItem costume={topThree[1]} rank={2} totalVotes={totalVotes} />}
          {topThree[0] && <PodiumItem costume={topThree[0]} rank={1} totalVotes={totalVotes} />}
          {topThree[2] && <PodiumItem costume={topThree[2]} rank={3} totalVotes={totalVotes} />}
        </div>
      )}
      
      {rest.length > 0 && (
        <div>
          {rest.map((costume, index) => (
            <LeaderboardItem key={costume.id} costume={costume} rank={index + 4} totalVotes={totalVotes} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
