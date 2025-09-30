import React from 'react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { Sparkles } from 'lucide-react';
import { toast } from './Toast';

const LoginPage: React.FC = () => {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome, Spooky Voter!");
    } catch (error: any) {
      console.error("Authentication error:", error);

      if (error.code === "auth/popup-closed-by-user") {
        toast.error("You closed the login popup. Please try again.");
      } else if (error.code === "auth/popup-blocked") {
        // fallback ไปใช้ redirect อัตโนมัติ
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("Redirect login failed:", redirectError);
          toast.error("Failed to sign in. Please try again.");
        }
      } else {
        toast.error("Failed to sign in. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-orange-900 via-purple-900 to-black"></div>
      
      <div className="z-10 text-center bg-black/50 backdrop-blur-sm p-8 md:p-12 rounded-2xl border border-purple-500/50 shadow-2xl shadow-purple-500/20">
        <h1 className="font-creepster text-5xl md:text-7xl text-orange-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-2">
          Halloween Costume Contest
        </h1>
        <p className="text-yellow-400 text-lg md:text-2xl mb-8 animate-pulse">
          🎃 Cast Your Vote! 👻
        </p>
        <button
          onClick={handleLogin}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg shadow-lg hover:shadow-orange-500/50 transition-all duration-300 transform hover:scale-105 overflow-hidden"
        >
          <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-white/20 rounded-full group-hover:w-56 group-hover:h-56"></span>
          <span className="relative flex items-center">
            <Sparkles className="mr-3 h-6 w-6" />
            Sign in with Google
          </span>
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
