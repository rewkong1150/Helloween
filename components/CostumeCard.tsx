import React, { useState } from 'react';
import type { Costume } from '../types';
import { ThumbsUp, Flame, Check, X } from 'lucide-react';

interface CostumeCardProps {
  costume: Costume;
  onVote: (userId: string) => void;
  isOwnCostume: boolean;
  isVotedFor: boolean;
}

const CostumeCard: React.FC<CostumeCardProps> = ({ costume, onVote, isOwnCostume, isVotedFor }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Card */}
      <div
        className={`relative group bg-gradient-to-br from-purple-900/50 to-black/50 p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer
        ${isVotedFor ? 'border-orange-500 shadow-lg shadow-orange-500/30' : 'border-purple-700/50'}
        hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-2`}
        onClick={() => setIsModalOpen(true)}
      >
        {isOwnCostume && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full z-10">
            Your Costume
          </div>
        )}
        <div className="relative w-full h-80 rounded-lg overflow-hidden mb-4">
          {costume.mediaType === 'video' ? (
            <video
              src={costume.mediaUrl}
              controls
              muted
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <img
              src={costume.mediaUrl}
              alt={costume.costumeName}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20"></div>
          <div className="absolute top-2 left-2 flex items-center bg-black/50 p-1.5 rounded-full">
            {costume.userPhoto && (
              <img
                src={costume.userPhoto}
                alt={costume.userName}
                className="w-8 h-8 rounded-full border-2 border-purple-400"
              />
            )}
            <span className="text-white text-sm font-semibold ml-2 pr-2">{costume.userName}</span>
          </div>
        </div>

        <h3 className="font-creepster text-3xl text-orange-400 truncate">{costume.costumeName}</h3>
        {costume.position && (
          <p className="text-yellow-400 font-semibold text-sm mb-1">Position: {costume.position}</p>
        )}
        {costume.uploaderName && (
          <p className="text-gray-300 text-sm mb-1">Uploader: {costume.uploaderName}</p>
        )}
        {costume.description && (
          <p className="text-gray-300 text-sm mb-2">{costume.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center text-2xl font-bold text-yellow-400">
            <Flame className="h-6 w-6 mr-2 text-orange-500 animate-pulse" />
            
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation(); // ไม่ให้ modal เปิดเวลา vote
              onVote(costume.userId);
            }}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-w-3xl w-full max-h-full overflow-auto rounded-lg shadow-2xl bg-black p-4">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-2 right-2 text-white hover:text-red-500"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="w-full h-auto mb-4">
              {costume.mediaType === 'video' ? (
                <video src={costume.mediaUrl} controls autoPlay className="w-full max-h-[80vh] rounded-lg" />
              ) : (
                <img src={costume.mediaUrl} alt={costume.costumeName} className="w-full max-h-[80vh] object-contain rounded-lg" />
              )}
            </div>
            <div className="text-white space-y-1">
              <h2 className="font-creepster text-2xl text-orange-400">{costume.costumeName}</h2>
              {costume.position && <p>Position: {costume.position}</p>}
              {costume.uploaderName && <p>Uploader: {costume.uploaderName}</p>}
              {costume.description && <p>Description: {costume.description}</p>}
              <p>Votes: {costume.voteCount}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CostumeCard;
