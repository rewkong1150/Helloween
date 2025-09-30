
import React from 'react';
import type { Costume } from '../types';
import { ThumbsUp, Flame, Check } from 'lucide-react';

interface CostumeCardProps {
  costume: Costume;
  onVote: (userId: string) => void;
  isOwnCostume: boolean;
  isVotedFor: boolean;
}

const CostumeCard: React.FC<CostumeCardProps> = ({ costume, onVote, isOwnCostume, isVotedFor }) => {
  return (
    <div
      className={`relative group bg-gradient-to-br from-purple-900/50 to-black/50 p-4 rounded-xl border-2 transition-all duration-300
      ${isVotedFor ? 'border-orange-500 shadow-lg shadow-orange-500/30' : 'border-purple-700/50'}
      hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-2`}
    >
      {isOwnCostume && (
        <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full z-10">
          Your Costume
        </div>
      )}
      <div className="relative w-full h-80 rounded-lg overflow-hidden mb-4">
        <img
          src={costume.costumeImage}
          alt={costume.costumeName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20"></div>
        <div className="absolute top-2 left-2 flex items-center bg-black/50 p-1.5 rounded-full">
          <img
            src={costume.userPhoto}
            alt={costume.userName}
            className="w-8 h-8 rounded-full border-2 border-purple-400"
          />
          <span className="text-white text-sm font-semibold ml-2 pr-2">{costume.userName}</span>
        </div>
      </div>
      
      <h3 className="font-creepster text-3xl text-orange-400 truncate">{costume.costumeName}</h3>
      <p className="text-gray-300 text-sm h-10 overflow-hidden mb-4">{costume.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center text-2xl font-bold text-yellow-400">
          <Flame className="h-6 w-6 mr-2 text-orange-500 animate-pulse" />
          {costume.voteCount}
        </div>
        <button
          onClick={() => onVote(costume.userId)}
          disabled={isOwnCostume || isVotedFor}
          className={`px-5 py-2.5 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center
            ${isOwnCostume 
              ? 'bg-gray-600/50 cursor-not-allowed'
              : isVotedFor 
                ? 'bg-green-600'
                : 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 transform hover:scale-105'
            }
          `}
        >
          {isOwnCostume ? 'Your Entry' : isVotedFor ? (
            <>
              <Check className="mr-2 h-5 w-5" /> Voted
            </>
          ) : (
            <>
              <ThumbsUp className="mr-2 h-5 w-5" /> Vote
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CostumeCard;
