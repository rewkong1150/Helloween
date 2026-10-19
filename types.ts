import type { Timestamp } from 'firebase/firestore';

export type Category = 'costume' | 'decoration' | 'pet';

export interface Costume {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  uploaderName?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  costumeName: string;
  position?: string;
  description: string;
  // Entries created before categories existed have no category (treated as 'costume').
  category?: Category;
  uploadedAt: Timestamp;
  voteCount: number;
}

export interface Vote {
  voterId: string;
  // Id of the voted entry (costume document id).
  votedFor: string;
  // Votes created before categories existed have no category (treated as 'costume').
  category?: Category;
  votedAt: Timestamp;
}
