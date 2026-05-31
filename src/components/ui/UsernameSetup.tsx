import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, AtSign, AlertCircle } from 'lucide-react';
import { validateUsername, checkUsernameAvailable, claimUsername } from '../../lib/usernames';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';

interface UsernameSetupProps {
  isOpen: boolean;
  onClose: () => void;
  /** If true, user CANNOT dismiss. Used for mandatory setup. */
  mandatory?: boolean;
  /** Called after username is successfully claimed */
  onComplete?: (username: string) => void;
}

export default function UsernameSetup({ isOpen, onClose, mandatory = false, onComplete }: UsernameSetupProps) {
  const { user, userData } = useAuth();
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill with current username if editing
  useEffect(() => {
    if (isOpen && userData?.username) {
      setUsername(userData.username);
      setAvailable(true);
    } else {
      setUsername('');
      setAvailable(null);
    }
    setValidationError(null);
  }, [isOpen, userData]);

  const checkAvailability = useCallback(async (value: string) => {
    const validation = validateUsername(value);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid username');
      setAvailable(null);
      setChecking(false);
      return;
    }

    setValidationError(null);
    setChecking(true);
    
    try {
      const isAvailable = await checkUsernameAvailable(value);
      // If user already owns this username, it's "available" for them
      const isOwnUsername = userData?.username?.toLowerCase() === value.toLowerCase();
      setAvailable(isAvailable || isOwnUsername);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setUsername(value);
    setAvailable(null);
    setValidationError(null);

    // Debounce the availability check
    if (debounceTimer) clearTimeout(debounceTimer);
    
    if (value.length >= 3) {
      const timer = setTimeout(() => checkAvailability(value), 400);
      setDebounceTimer(timer);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !username || !available || submitting) return;

    setSubmitting(true);
    try {
      await claimUsername(user.uid, username, userData?.username);
      showToast('Username claimed! 🎉', 'success');
      onComplete?.(username);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to claim username', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ background: 'var(--color-overlay)' }}
        onClick={mandatory ? undefined : onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md relative rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient header */}
          <div className="h-2 w-full bg-gradient-to-r from-brand-teal via-brand-pink to-brand-mint" />
          
          <div className="p-8">
            {!mandatory && (
              <button onClick={onClose} className="absolute top-6 right-6 p-2 text-luxury-ink/40 hover:text-luxury-ink transition-colors">
                <X size={20} />
              </button>
            )}

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center">
                <AtSign size={20} className="text-brand-teal" />
              </div>
              <h3 className="text-xl font-bold text-luxury-ink">
                {userData?.username ? 'Change Username' : 'Choose Your Username'}
              </h3>
            </div>
            
            <p className="text-xs font-bold uppercase tracking-widest text-luxury-ink/40 mb-8 ml-[52px]">
              {userData?.username 
                ? 'Update your unique identifier.' 
                : 'This is how people find you on Nextbench.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-teal/50 ml-1">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-luxury-ink/30 font-bold text-sm">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={handleChange}
                    placeholder="your.username"
                    maxLength={20}
                    autoFocus
                    className="w-full rounded-xl py-4 pl-10 pr-12 text-sm font-medium theme-input"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {checking && <Loader2 size={18} className="text-luxury-ink/30 animate-spin" />}
                    {!checking && available === true && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Check size={18} className="text-brand-mint" />
                      </motion.div>
                    )}
                    {!checking && available === false && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <X size={18} className="text-brand-pink" />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Status messages */}
                <div className="min-h-[20px] ml-1">
                  {validationError && (
                    <p className="text-[11px] text-brand-pink font-medium flex items-center gap-1">
                      <AlertCircle size={12} /> {validationError}
                    </p>
                  )}
                  {!validationError && available === true && !checking && (
                    <p className="text-[11px] text-brand-mint font-medium flex items-center gap-1">
                      <Check size={12} /> Username is available!
                    </p>
                  )}
                  {!validationError && available === false && !checking && (
                    <p className="text-[11px] text-brand-pink font-medium flex items-center gap-1">
                      <X size={12} /> Username is taken
                    </p>
                  )}
                </div>
              </div>

              {/* Rules */}
              <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-soft)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/30 mb-2">Rules</p>
                <ul className="text-[11px] text-luxury-ink/50 space-y-1">
                  <li>• 3–20 characters, starts with a letter</li>
                  <li>• Only lowercase letters, numbers, underscores, and dots</li>
                  <li>• Your profile URL: nextbench.in/u/<span className="text-brand-teal font-bold">{username || 'username'}</span></li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={!available || checking || submitting || !!validationError}
                className="w-full py-4 bg-brand-teal text-white text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg hover:bg-brand-pink transition-colors rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Claiming...</>
                ) : (
                  'Claim Username'
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
