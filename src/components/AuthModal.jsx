import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { register, login, error: authError } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        // Validate registration fields
        if (!email || !username || !password || !confirmPassword) {
          setError('All fields are required');
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }

        const result = await register(email, username, password);

        if (result.success) {
          setSuccess('Account created successfully!');
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setError(result.error || 'Registration failed');
        }
      } else {
        // Login
        if (!email || !password) {
          setError('Email and password are required');
          return;
        }

        const result = await login(email, password);

        if (result.success) {
          setSuccess('Logged in successfully!');
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setSuccess('');
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-main/90 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md mx-4 bg-surface rounded-2xl border border-primary/40 shadow-2xl animate-pop-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-accent hover:text-main transition"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-primary/20">
          <h2 className="text-2xl font-serif text-accent">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {mode === 'login'
              ? 'Sign in to access your journal across devices'
              : 'Register to save your readings to the cloud'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6">
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-accent mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-surface-muted border border-primary/30 rounded-lg text-main placeholder-main/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            {/* Username (register only) */}
            {mode === 'register' && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-accent mb-1">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-surface-muted border border-primary/30 rounded-lg text-main placeholder-main/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Choose a username"
                  required
                  disabled={loading}
                  pattern="[a-zA-Z0-9_]{3,30}"
                  title="3-30 characters, letters, numbers, and underscores only"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-accent mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-surface-muted border border-primary/30 rounded-lg text-main placeholder-main/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                required
                disabled={loading}
                minLength={8}
              />
            </div>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-accent mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-surface-muted border border-primary/30 rounded-lg text-main placeholder-main/40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Confirm your password"
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>
            )}
          </div>

          {/* Error message */}
          {(error || authError) && (
            <div className="mt-4 p-3 bg-error/10 border border-error/40 rounded-lg">
              <p className="text-sm text-error">{error || authError}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mt-4 p-3 bg-secondary/10 border border-secondary/40 rounded-lg">
              <p className="text-sm text-secondary">{success}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full px-6 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>

          {/* Switch mode */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={switchMode}
              className="text-sm text-accent hover:text-accent/80 underline"
              disabled={loading}
            >
              {mode === 'login'
                ? "Don't have an account? Register"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-8 pb-8 pt-4 border-t border-primary/20">
          <p className="text-xs text-muted/50 text-center">
            Your readings are private. We never share your data.
          </p>
        </div>
      </div>
    </div>
  );
}
