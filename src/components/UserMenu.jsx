import React, { useState } from 'react';
import { LogIn, User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

export function UserMenu() {
  const { isAuthenticated, user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
    setShowDropdown(false);
  };

  return (
    <>
      <div className="relative z-40">
        {isAuthenticated ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/50 border border-accent/20 hover:bg-surface hover:border-accent/40 transition text-xs-plus font-semibold text-accent"
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline max-w-[100px] truncate">{user?.username}</span>
            </button>

            {showDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowDropdown(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 mt-2 w-48 py-1 bg-surface border border-accent/20 rounded-xl shadow-lg z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-accent/10">
                    <p className="text-xs text-muted">Signed in as</p>
                    <p className="text-sm font-semibold text-accent truncate">{user?.username}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-accent hover:bg-accent/5 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20 transition text-xs-plus font-semibold"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
