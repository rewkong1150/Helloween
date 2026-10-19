export type Category = 'costume' | 'decoration' | 'pet';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export interface Costume {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  uploaderName: string;
  mediaUrl: string;
  // Path inside the storage bucket, used to delete the file.
  mediaPath: string;
  mediaType: 'image' | 'video';
  // Small JPEG for lists (a still frame for videos). Missing on older entries or if it could not be made.
  thumbUrl?: string | null;
  thumbPath?: string | null;
  costumeName: string;
  position: string;
  description: string;
  category: Category;
  uploadedAt: string;
  // Only known once results are open (see get_results() in supabase/schema.sql).
  voteCount?: number;
}
