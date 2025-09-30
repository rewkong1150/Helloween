
import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import type { Costume } from './types';

import LoginPage from './components/LoginPage';
import Navbar from './components/Navbar';
import GalleryPage from './components/GalleryPage';
import UploadPage from './components/UploadPage';
import ResultsPage from './components/ResultsPage';
import FloatingGhosts from './components/FloatingGhosts';
import { ToastContainer, toast } from './components/Toast';

type Page = 'gallery' | 'upload' | 'results';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('gallery');
  const [userCostume, setUserCostume] = useState<Costume | null>(null);

  const fetchUserCostume = useCallback(async (userId: string) => {
    const costumeRef = doc(db, 'costumes', userId);
    const docSnap = await getDoc(costumeRef);
    if (docSnap.exists()) {
      setUserCostume({ id: docSnap.id, ...docSnap.data() } as Costume);
    } else {
      setUserCostume(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserCostume(currentUser.uid);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserCostume]);

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

  const handleCostumeUpdate = (costume: Costume | null) => {
    setUserCostume(costume);
    toast.success(costume ? "Costume updated successfully!" : "Costume deleted successfully!");
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
            {page === 'upload' && <UploadPage user={user} existingCostume={userCostume} onCostumeUpdate={handleCostumeUpdate} />}
            {page === 'results' && <ResultsPage />}
          </main>
        </>
      )}
    </div>
  );
};

export default App;
