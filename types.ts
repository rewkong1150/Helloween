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
  costumeName: string;
  position: string;
  description: string;
  category: Category;
  uploadedAt: string;
  // Only known once results are open (see get_results() in supabase/schema.sql).
  voteCount?: number;
}
