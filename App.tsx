import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './services/supabase';
import { rowToCostume, toAppUser, type EntryRow } from './services/entries';
import type { AppUser, Costume, Category } from './types';
import { COMPANY_DOMAIN, isAllowedEmail } from './config';

import LoginPage from './components/LoginPage';
import Navbar from './components/Navbar';
import GalleryPage from './components/GalleryPage';
import UploadPage from './components/UploadPage';
import ResultsPage from './components/ResultsPage';
import FloatingGhosts from './components/FloatingGhosts';
import { ToastContainer } from './components/Toast';

type Page = 'gallery' | 'upload' | 'results';

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('gallery');
  const [userCostumes, setUserCostumes] = useState<Costume[]>([]);

  const fetchUserCostumes = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('entries').select('*').eq('user_id', userId);
    if (error) console.error('Error loading your entries:', error);
    setUserCostumes(((data ?? []) as EntryRow[]).map((row) => rowToCostume(row)));
  }, []);

  useEffect(() => {
    const applySession = async (supabaseUser: Parameters<typeof toAppUser>[0] | null) => {
      if (supabaseUser) {
        setUser(toAppUser(supabaseUser));
        await fetchUserCostumes(supabaseUser.id);
      } else {
        setUser(null);
        setUserCostumes([]);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer: calling supabase inside this callback can deadlock the auth lock.
      setTimeout(() => applySession(session?.user ?? null), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [fetchUserCostumes]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      if (['gallery', 'upload', 'results'].includes(hash)) {
        setPage(hash as Page);
      } else {
        setPage('gallery');
      }
    };
    window.addEventListener('hashchange', handleHashChange, false);
    handleHashChange(); // Initial check
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (p: Page) => {
    window.location.hash = `/${p}`;
  };

  const handleCostumeUpdate = (category: Category, costume: Costume | null) => {
    setUserCostumes((prev) => {
      const others = prev.filter((c) => c.category !== category);
      return costume ? [...others, costume] : others;
    });
    navigate('gallery');
  };

  // Development-only: preview the results page with made-up data and no sign-in (?mockresults).
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('mockresults')) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-900 via-purple-900 to-black text-white">
        <FloatingGhosts />
        <main className="relative z-10 container mx-auto px-4 py-8">
          <ResultsPage />
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="font-display text-5xl text-orange-500 animate-pulse">Loading... 🕯️</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-900 via-purple-900 to-black text-white selection:bg-orange-500/30">
      <ToastContainer />
      <FloatingGhosts />
      {!user ? (
        <LoginPage />
      ) : !isAllowedEmail(user.email) ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md text-center bg-black/60 p-8 rounded-2xl border border-purple-500/50">
            <h2 className="font-display text-3xl text-orange-400 mb-3">Company accounts only</h2>
            <p className="text-gray-300">
              This contest is open to @{COMPANY_DOMAIN} accounts. You are signed in as <b>{user.email}</b>.
              Please sign out and use your company email.
              <br />
              กิจกรรมนี้สำหรับอีเมลบริษัทเท่านั้น กรุณาออกจากระบบแล้วเข้าด้วยอีเมลบริษัท
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-6 px-5 py-2 rounded-md border border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <>
          <Navbar user={user} navigate={navigate} currentPage={page} />
          <main className="relative z-10 container mx-auto px-4 py-8 pt-24">
            {page === 'gallery' && <GalleryPage currentUser={user} />}
            {page === 'upload' && <UploadPage user={user} existingCostumes={userCostumes} onCostumeUpdate={handleCostumeUpdate} />}
            {page === 'results' && <ResultsPage />}
          </main>
        </>
      )}
    </div>
  );
};

export default App;
