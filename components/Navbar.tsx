
import React from 'react';
import type { User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
// FIX: The 'Pumpkin' icon does not exist in lucide-react. Replaced it with the 'Ghost' icon to fit the Halloween theme.
import { Crown, GalleryHorizontal, LogOut, Upload, Trophy, Ghost } from 'lucide-react';
import { toast } from './Toast';

interface NavbarProps {
  user: User;
  navigate: (page: 'gallery' | 'upload' | 'results') => void;
  currentPage: 'gallery' | 'upload' | 'results';
}

const NavLink: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
}> = ({ onClick, isActive, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
      isActive
        ? 'bg-orange-600 text-white shadow-md'
        : 'text-gray-300 hover:bg-purple-700/50 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const Navbar: React.FC<NavbarProps> = ({ user, navigate, currentPage }) => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("You've been logged out!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to log out.");
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-purple-500/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => navigate('gallery')}
          >
            <Ghost className="h-8 w-8 text-orange-500 animate-pulse" />
            <span className="font-creepster text-2xl ml-2 text-orange-400 hidden sm:block">Costume Contest</span>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <NavLink onClick={() => navigate('gallery')} isActive={currentPage === 'gallery'}>
              <GalleryHorizontal className="mr-2 h-4 w-4" /> Gallery
            </NavLink>
            <NavLink onClick={() => navigate('upload')} isActive={currentPage === 'upload'}>
              <Upload className="mr-2 h-4 w-4" /> Upload
            </NavLink>
            <NavLink onClick={() => navigate('results')} isActive={currentPage === 'results'}>
              <Trophy className="mr-2 h-4 w-4" /> Results
            </NavLink>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <img
                src={user.photoURL || `https://picsum.photos/seed/${user.uid}/40`}
                alt={user.displayName || 'User'}
                className="h-9 w-9 rounded-full border-2 border-orange-500"
              />
              <span className="text-white font-semibold ml-3 hidden md:block">{user.displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full text-gray-300 hover:bg-red-600/50 hover:text-white transition-colors duration-200"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;