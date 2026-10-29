import type { Category } from './types';

export interface CategoryInfo {
  id: Category;
  emoji: string;
  label: string;
  labelTh: string;
  description: string;
  entryName: string;
  hint?: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'costume',
    emoji: '🧛',
    label: 'Best Halloween Costume',
    labelTh: 'ชุดฮาโลวีนยอดเยี่ยม',
    description: 'Your most creative, scary, funny, or unexpected Halloween look!',
    entryName: 'Costume Name',
  },
  {
    id: 'decoration',
    emoji: '🏚️',
    label: 'Best Decoration or Prop',
    labelTh: 'ของตกแต่ง/พร็อพยอดเยี่ยม',
    description: 'A decorated home, a spooky corner, or an amazing Halloween accessory.',
    entryName: 'Decoration / Prop Name',
  },
  {
    id: 'pet',
    emoji: '🐾',
    label: 'Best Pet Halloween Look',
    labelTh: 'สัตว์เลี้ยงสุดน่ารักสไตล์ฮาโลวีน',
    description: 'Our furry friends get their own category!',
    entryName: 'Pet Name / Look',
    hint: 'Please make sure your pet is comfortable and happy — no costumes or accessories if they cause stress. A cute Halloween-themed photo or a simple festive accessory is more than enough. ❤️ / ขอให้สัตว์เลี้ยงสบายใจ ไม่ต้องแต่งตัวถ้าทำให้เครียด',
  },
];


export const getCategoryInfo = (category: Category): CategoryInfo =>
  CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

// Only company accounts may take part. Mirrors is_company_user() in supabase/patch-company-only.sql,
// which is what the server actually enforces; this copy only lets the UI explain what is going on.
export const COMPANY_DOMAIN = 'villacartegroup.com';
const EXTRA_ALLOWED_EMAILS = ['rewkong1150@gmail.com'];
export const isAllowedEmail = (email: string) => {
  const e = email.trim().toLowerCase();
  const domain = COMPANY_DOMAIN.replace(/\./g, '\\.');
  return new RegExp(`^[^+@]+@${domain}$`).test(e) || EXTRA_ALLOWED_EMAILS.includes(e);
};

// Schedule (Thailand time, GMT+7). Keep in sync with upload_open()/voting_open()/results_open()
// in supabase/schema.sql, which is what actually enforces it.
export const UPLOAD_START = new Date('2026-10-19T00:00:00+07:00');
export const UPLOAD_END = new Date('2026-10-30T18:00:00+07:00');
export const VOTE_START = new Date('2026-10-30T18:00:00+07:00');
export const VOTE_END = new Date('2026-10-31T18:00:00+07:00');
export const RESULTS_AT = new Date('2026-10-31T18:00:00+07:00');
