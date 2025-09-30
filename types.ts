
import type { Timestamp } from 'firebase/firestore';

export interface Costume {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  costumeImage: string;
  costumeName: string;
  description: string;
  uploadedAt: Timestamp;
  voteCount: number;
}

export interface Vote {
  voterId: string;
  votedFor: string;
  votedAt: Timestamp;
}
