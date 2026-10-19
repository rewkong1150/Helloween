import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Sparkles, Mail } from 'lucide-react';
import { toast } from './Toast';

const redirectTo = () => window.location.origin + window.location.pathname;

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      console.error('Authentication error:', error);
      toast.error('Failed to sign in with Google. Please try again.');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    setSending(false);
    if (error) {
      console.error('Email sign-in error:', error);
      toast.error('Could not send the sign-in link. Please try again later.');
    } else {
      toast.success('Check your email for the sign-in link! 📬');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-orange-900 via-purple-900 to-black"></div>

      <div className="z-10 text-center bg-black/50 backdrop-blur-sm p-8 md:p-12 rounded-2xl border border-purple-500/50 shadow-2xl shadow-purple-500/20">
        <h1 className="font-creepster text-5xl md:text-7xl text-orange-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-2">
          Halloween Challenge
        </h1>
        <p className="text-yellow-400 text-lg md:text-2xl mb-8 animate-pulse">
          🎃 Costumes · Decorations · Pets 👻
        </p>
        <button
          onClick={handleGoogleLogin}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg shadow-lg hover:shadow-orange-500/50 transition-all duration-300 transform hover:scale-105 overflow-hidden"
        >
          <span className="absolute w-0 h-0 transition-all duration-300 ease-out bg-white/20 rounded-full group-hover:w-56 group-hover:h-56"></span>
          <span className="relative flex items-center">
            <Sparkles className="mr-3 h-6 w-6" />
            Sign in with Google
          </span>
        </button>

        <div className="my-6 flex items-center gap-3 text-sm text-gray-400">
          <span className="flex-1 h-px bg-purple-500/40"></span>
          or
          <span className="flex-1 h-px bg-purple-500/40"></span>
        </div>

        <form onSubmit={handleEmailLogin} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="flex-1 min-w-0 bg-purple-900/50 border border-purple-600 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center px-4 py-2 rounded-md border border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white disabled:opacity-50 transition-colors"
          >
            <Mail className="mr-2 h-4 w-4" />
            {sending ? 'Sending...' : 'Email link'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
