import type { User } from '@supabase/supabase-js';
import type { AppUser, Costume, Category } from '../types';

// Row shape of public.entries (see supabase/schema.sql).
export interface EntryRow {
  id: string;
  user_id: string;
  category: Category;
  user_name: string;
  user_photo: string;
  uploader_name: string;
  name: string;
  position: string | null;
  description: string;
  media_url: string;
  media_path: string;
  media_type: 'image' | 'video';
  thumb_url: string | null;
  thumb_path: string | null;
  created_at: string;
}

export const rowToCostume = (row: EntryRow, voteCount?: number): Costume => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userPhoto: row.user_photo,
  uploaderName: row.uploader_name,
  mediaUrl: row.media_url,
  mediaPath: row.media_path,
  mediaType: row.media_type,
  thumbUrl: row.thumb_url,
  thumbPath: row.thumb_path,
  costumeName: row.name,
  position: row.position ?? '',
  description: row.description,
  category: row.category,
  uploadedAt: row.created_at,
  voteCount,
});

export const toAppUser = (user: User): AppUser => {
  const meta = user.user_metadata ?? {};
  return {
    uid: user.id,
    email: user.email ?? '',
    displayName: meta.full_name || meta.name || user.email?.split('@')[0] || '',
    photoURL: meta.avatar_url || meta.picture || '',
  };
};
