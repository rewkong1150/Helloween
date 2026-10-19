import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './services/supabase';
import { rowToCostume, toAppUser, type EntryRow } from './services/entries';
import type { AppUser, Costume, Category } from './types';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="font-creepster text-5xl text-orange-500 animate-pulse">Loading... 🎃</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-900 via-purple-900 to-black text-white selection:bg-orange-500/30">
      <ToastContainer />
      <FloatingGhosts />
      {!user ? (
        <LoginPage />
      ) : (
        <>
          <Navbar user={user} navigate={navigate} currentPage={page} />
          <main className="container mx-auto px-4 py-8 pt-24">
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
