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
  category: Category;
  uploadedAt: Timestamp;
  voteCount: number;
}

export interface Vote {
  voterId: string;
  // Id of the voted entry (costume document id).
  votedFor: string;
  category: Category;
  votedAt: Timestamp;
}
