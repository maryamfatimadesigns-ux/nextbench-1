import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Moon, Sun, ShieldAlert, Edit2, LogOut, Loader2, LifeBuoy } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
import { claimUsername, validateUsername } from '../../lib/usernames';
import { Link, useNavigate } from 'react-router-dom';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileSettings({ isOpen, onClose }: ProfileSettingsProps) {
  const { user, userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'general' | 'blocked' | 'account' | 'support'>('general');
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Username states
  const [newUsername, setNewUsername] = useState('');
  const [isChangingUsername, setIsChangingUsername] = useState(false);

  // Support states
  const [supportReason, setSupportReason] = useState('');
  const [supportDetails, setSupportDetails] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'blocked' && user) {
      loadBlockedUsers();
    }
  }, [isOpen, activeTab, user]);

  const loadBlockedUsers = async () => {
    if (!user) return;
    setLoadingBlocked(true);
    try {
      const q = query(collection(db, 'blocks'), where('blockerId', '==', user.uid));
      const snap = await getDocs(q);
      const users: any[] = [];
      for (const d of snap.docs) {
        const blockData = d.data();
        const userDoc = await getDoc(doc(db, 'users', blockData.blockedId));
        if (userDoc.exists()) {
          users.push({ blockDocId: d.id, id: userDoc.id, ...userDoc.data() });
        }
      }
      setBlockedUsers(users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblock = async (blockDocId: string) => {
    try {
      await deleteDoc(doc(db, 'blocks', blockDocId));
      setBlockedUsers(prev => prev.filter(u => u.blockDocId !== blockDocId));
      showToast('User unblocked', 'success');
    } catch (err) {
      showToast('Failed to unblock user', 'error');
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;

    if (!newUsername.trim()) {
      showToast('Username cannot be empty', 'error');
      return;
    }

    const val = validateUsername(newUsername.trim());
    if (!val.valid) {
      showToast(val.error || 'Invalid username', 'error');
      return;
    }

    setIsChangingUsername(true);
    try {
      await claimUsername(user.uid, newUsername.trim(), userData.username);
      showToast('Username updated successfully!', 'success');
      setNewUsername('');
    } catch (err: any) {
      showToast(err.message || 'Failed to update username', 'error');
    } finally {
      setIsChangingUsername(false);
    }
  };

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!supportReason.trim() || !supportDetails.trim()) {
      showToast('Please fill out all fields', 'error');
      return;
    }
    setIsSubmittingSupport(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        contentType: 'support_ticket',
        contentId: 'general',
        reason: supportReason.trim(),
        details: supportDetails.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      showToast('Support ticket submitted successfully!', 'success');
      setSupportReason('');
      setSupportDetails('');
      setActiveTab('general');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit support ticket', 'error');
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md"
        style={{ background: 'var(--color-overlay-heavy)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b flex items-center justify-between bg-surface-base" style={{ borderColor: 'var(--color-border)' }}>
            <h2 className="text-xl font-bold text-luxury-ink">Settings</h2>
            <button onClick={onClose} className="p-2 text-luxury-ink/40 hover:text-luxury-ink rounded-full transition-colors bg-surface-soft">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-1/3 border-r bg-surface-base flex flex-col" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setActiveTab('general')}
                className={`p-4 text-left text-sm font-bold transition-all ${activeTab === 'general' ? 'text-brand-teal bg-brand-teal/5' : 'text-luxury-ink/60 hover:text-luxury-ink hover:bg-surface-soft'}`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`p-4 text-left text-sm font-bold transition-all ${activeTab === 'account' ? 'text-brand-teal bg-brand-teal/5' : 'text-luxury-ink/60 hover:text-luxury-ink hover:bg-surface-soft'}`}
              >
                Account
              </button>
              <button
                onClick={() => setActiveTab('blocked')}
                className={`p-4 text-left text-sm font-bold transition-all ${activeTab === 'blocked' ? 'text-brand-teal bg-brand-teal/5' : 'text-luxury-ink/60 hover:text-luxury-ink hover:bg-surface-soft'}`}
              >
                Blocked Users
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === 'general' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-luxury-ink mb-4 uppercase tracking-widest">Appearance</h3>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-surface-soft/50 border" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-teal/10 rounded-lg text-brand-teal">
                          {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-luxury-ink text-sm">Dark Theme</p>
                          <p className="text-[10px] text-luxury-ink/50 uppercase tracking-widest">Toggle app theme</p>
                        </div>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className={`w-12 h-6 rounded-full transition-all relative ${theme === 'dark' ? 'bg-brand-teal' : 'bg-luxury-ink/20'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-luxury-ink mb-4 uppercase tracking-widest">Support</h3>
                    {userData?.isAdmin ? (
                      <Link
                        to="/admin"
                        onClick={onClose}
                        className="flex items-center justify-between p-4 rounded-xl bg-surface-soft/50 border hover:border-brand-teal transition-all group"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <LifeBuoy size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-luxury-ink text-sm group-hover:text-brand-teal transition-colors">Admin & Support</p>
                            <p className="text-[10px] text-luxury-ink/50 uppercase tracking-widest">Help center and reports</p>
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <button
                        onClick={() => setActiveTab('support')}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-soft/50 border hover:border-brand-teal transition-all group"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                            <LifeBuoy size={20} />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-luxury-ink text-sm group-hover:text-brand-teal transition-colors">Support</p>
                            <p className="text-[10px] text-luxury-ink/50 uppercase tracking-widest">Contact our team</p>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-luxury-ink mb-4 uppercase tracking-widest">Username</h3>
                    
                    <div className="p-4 rounded-xl bg-surface-soft/50 border mb-4" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-xs text-luxury-ink/70 mb-2">
                        You can change your username once every 30 days.
                      </p>
                      {userData?.lastUsernameChange && (
                        <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mb-4">
                          Last changed: {userData.lastUsernameChange.toDate().toLocaleDateString()}
                        </p>
                      )}
                      
                      <form onSubmit={handleChangeUsername} className="flex gap-2">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-ink/40 font-bold">@</span>
                          <input
                            type="text"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                            placeholder={userData?.username || "New username"}
                            className="w-full bg-surface-base border rounded-lg py-2 pl-8 pr-4 text-sm font-medium focus:outline-none focus:border-brand-teal"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isChangingUsername || !newUsername.trim()}
                          className="px-4 py-2 bg-brand-teal text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                        >
                          {isChangingUsername ? 'Saving...' : 'Update'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'blocked' && (
                <div>
                  <h3 className="text-sm font-bold text-luxury-ink mb-4 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-500" /> Blocked Users
                  </h3>
                  
                  {loadingBlocked ? (
                    <div className="py-8 text-center">
                      <Loader2 size={24} className="animate-spin text-luxury-ink/20 mx-auto" />
                    </div>
                  ) : blockedUsers.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-sm text-luxury-ink/40 font-medium">You haven't blocked anyone.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {blockedUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border bg-surface-soft/30" style={{ borderColor: 'var(--color-border)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-surface-base flex items-center justify-center overflow-hidden">
                              {u.profilePicture ? (
                                <img src={u.profilePicture} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-bold text-luxury-ink">{u.name?.[0]}</span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-luxury-ink">{u.name}</p>
                              {u.username && <p className="text-[10px] text-luxury-ink/40">@{u.username}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnblock(u.blockDocId)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border hover:bg-surface-base transition-colors text-luxury-ink"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'support' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-luxury-ink uppercase tracking-widest flex items-center gap-2">
                    <LifeBuoy size={16} className="text-amber-500" /> Contact Support
                  </h3>
                  <div className="p-4 rounded-xl bg-surface-soft/50 border" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-xs text-luxury-ink/70 mb-4">
                      Need help? Describe your issue below and our support team will review it.
                    </p>
                    <form onSubmit={handleSubmitSupport} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/50 block mb-1">Subject</label>
                        <input
                          type="text"
                          value={supportReason}
                          onChange={(e) => setSupportReason(e.target.value)}
                          placeholder="What do you need help with?"
                          required
                          className="w-full bg-surface-base border rounded-lg py-3 px-4 text-sm font-medium focus:outline-none focus:border-brand-teal"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/50 block mb-1">Details</label>
                        <textarea
                          value={supportDetails}
                          onChange={(e) => setSupportDetails(e.target.value)}
                          placeholder="Please provide as much detail as possible..."
                          required
                          rows={4}
                          className="w-full bg-surface-base border rounded-lg py-3 px-4 text-sm font-medium focus:outline-none focus:border-brand-teal resize-none"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('general')}
                          className="px-4 py-2 bg-surface-soft text-luxury-ink/60 rounded-lg text-xs font-bold hover:bg-luxury-ink/5 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingSupport}
                          className="px-6 py-2 bg-brand-teal text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors"
                        >
                          {isSubmittingSupport ? 'Submitting...' : 'Submit Ticket'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
