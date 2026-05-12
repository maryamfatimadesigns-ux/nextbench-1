import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Star, Package, CheckCircle2, Settings, MapPin, X, Smartphone, ExternalLink, Trash2, Camera } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useToast } from '../../lib/ToastContext';
import { uploadProfilePicture } from '../../lib/storage';

interface UserProduct {
  id: string; title: string; price: number; category: string; condition: string; image: string; status: string; createdAt: any;
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user, userData } = useAuth();
  const { showToast } = useToast();
  const [profileUser, setProfileUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [myListings, setMyListings] = useState<UserProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'sold'>('active');
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !userId || userId === user?.uid;

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Fetch profile user data
  useEffect(() => {
    const fetchUser = async () => {
      if (isOwnProfile) {
        setProfileUser(userData);
        setEditName(userData?.name || '');
        setEditAbout(userData?.about || '');
      } else if (userId) {
        try {
          const docSnap = await getDoc(doc(db, 'users', userId));
          if (docSnap.exists()) {
            setProfileUser(docSnap.data());
          } else {
            showToast('User not found', 'error');
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${userId}`);
        }
      }
    };
    fetchUser();
  }, [userId, isOwnProfile, userData]);

  // Fetch user's listings
  useEffect(() => {
    const targetUserId = isOwnProfile ? user?.uid : userId;
    if (!targetUserId) return;
    
    // Public profile: only fetch 'available' or 'sold' items. Own profile: fetch all.
    let q;
    if (isOwnProfile) {
      q = query(collection(db, 'products'), where('sellerId', '==', targetUserId));
    } else {
      q = query(collection(db, 'products'), where('sellerId', '==', targetUserId), where('status', 'in', ['available', 'sold']));
    }
    
    const unsub = onSnapshot(q, (snap) => {
      const prods: UserProduct[] = [];
      snap.forEach(d => prods.push({ id: d.id, ...d.data() } as UserProduct));
      setMyListings(prods);
    });
    return () => unsub();
  }, [userId, isOwnProfile, user]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isOwnProfile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: editName, about: editAbout || null, updatedAt: serverTimestamp() });
      setIsEditing(false);
      showToast('Profile updated!', 'success');
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`); }
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !user || !isOwnProfile) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }
    
    setIsUploadingPic(true);
    try {
      const imageUrl = await uploadProfilePicture(file, user.uid);
      await updateDoc(doc(db, 'users', user.uid), {
        profilePicture: imageUrl,
        updatedAt: serverTimestamp()
      });
      showToast('Profile picture updated!', 'success');
    } catch (err) {
      showToast('Failed to upload picture', 'error');
    } finally {
      setIsUploadingPic(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteListing = async (productId: string) => {
    if (!confirm('Delete this listing permanently?')) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
      showToast('Listing deleted', 'info');
    } catch (err) { handleFirestoreError(err, OperationType.DELETE, `products/${productId}`); }
  };

  if (!user || !profileUser) return <div className="pt-32 text-center text-xs font-bold uppercase tracking-widest text-luxury-ink/30">Loading profile...</div>;

  const [firstName, ...lastNameParts] = profileUser.name.split(' ');
  const lastName = lastNameParts.join(' ');

  const activeListings = myListings.filter(p => p.status === 'available');
  const pendingListings = myListings.filter(p => p.status === 'pending');
  const soldListings = myListings.filter(p => p.status === 'sold');
  const displayedListings = activeTab === 'active' ? activeListings : activeTab === 'pending' ? pendingListings : soldListings;

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-8 md:p-14 luxury-shadow border border-luxury-ink/5 mb-12 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-brand-teal/5 -skew-x-12 translate-x-1/2 pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start gap-10 relative z-10">
          <div className="relative shrink-0 group">
            <div className="w-32 h-32 rounded-2xl overflow-hidden luxury-shadow border-4 border-white flex items-center justify-center bg-brand-teal/5 text-brand-teal font-serif text-4xl relative">
              {profileUser.profilePicture ? (
                <img src={profileUser.profilePicture} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : firstName[0]?.toUpperCase()}
              
              {isOwnProfile && (
                <div onClick={() => !isUploadingPic && fileInputRef.current?.click()} className="absolute inset-0 bg-luxury-ink/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                  {isUploadingPic ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="text-white" size={24} />
                  )}
                </div>
              )}
            </div>
            {isOwnProfile && (
              <input type="file" ref={fileInputRef} onChange={handleProfilePictureUpload} accept="image/*" className="hidden" />
            )}
            {profileUser.verified && (
              <div className="absolute -bottom-3 -right-3 bg-brand-teal text-white p-2.5 rounded-xl shadow-lg border-2 border-white">
                <ShieldCheck size={20} />
              </div>
            )}
          </div>

          <div className="flex-1 w-full">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-serif font-bold text-luxury-ink mb-1 italic">{firstName} <span className="not-italic">{lastName}</span></h1>
                <p className="text-luxury-ink/50 font-medium flex items-center gap-2 text-sm"><MapPin size={14} className="text-brand-teal" /> {profileUser.school}</p>
                {profileUser.about && <p className="text-sm text-luxury-ink/70 max-w-md leading-relaxed mt-2">{profileUser.about}</p>}
              </div>
              <div className="flex gap-3">
                {isOwnProfile && (
                  <>
                    <button onClick={() => { setEditName(profileUser.name); setEditAbout(profileUser.about || ''); setIsEditing(true); }}
                      className="p-3 rounded-xl border border-luxury-ink/5 hover:bg-surface-soft transition-all"><Settings size={18} className="text-luxury-ink/40" /></button>
                    {deferredPrompt && (
                      <button onClick={handleInstallClick} className="p-3 rounded-xl bg-brand-teal text-white hover:bg-brand-pink transition-all luxury-shadow flex items-center gap-2" title="Install App">
                        <Smartphone size={18} /><span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Install</span>
                      </button>
                    )}
                    <Link to="/sell" className="bg-luxury-ink text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-teal transition-all text-sm">List Item</Link>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Reputation", value: profileUser.reputation?.toFixed(1) || '5.0', icon: Star, color: "text-brand-teal" },
                { label: "Total Deals", value: String(soldListings.length), icon: CheckCircle2, color: "text-brand-pink" },
                { label: "Active Listings", value: String(activeListings.length), icon: Package, color: "text-luxury-ink" },
                { label: "Level", value: profileUser.verified ? "Verified" : "Pending", icon: ShieldCheck, color: "text-brand-teal" }
              ].map((stat, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon size={14} className={`${stat.color} opacity-60`} />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-luxury-ink/30">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-serif font-bold text-luxury-ink">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Listings Section */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-serif font-bold text-luxury-ink">{isOwnProfile ? 'Your' : `${firstName}'s`} <span className="italic text-brand-pink font-normal">Vault.</span></h2>
        
        {isOwnProfile && (
          <div className="flex gap-2 bg-white rounded-xl p-1 luxury-shadow border border-luxury-ink/5">
            {([['active', `Active (${activeListings.length})`], ['pending', `Pending (${pendingListings.length})`], ['sold', `Sold (${soldListings.length})`]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as any)}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  activeTab === key ? 'bg-luxury-ink text-white' : 'text-luxury-ink/30 hover:text-luxury-ink/60'
                }`}>{label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {displayedListings.map(product => (
          <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-luxury-ink/5 luxury-shadow p-5">
            <div className="aspect-[4/3] rounded-xl overflow-hidden mb-5 relative">
              <img src={product.image} alt={product.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute top-3 right-3 flex gap-2">
                <Link to={`/product/${product.id}`} className="bg-white/90 backdrop-blur-md p-2 rounded-full text-luxury-ink/60 hover:text-brand-pink transition-colors"><ExternalLink size={14} /></Link>
                {isOwnProfile && (
                  <button onClick={() => handleDeleteListing(product.id)} className="bg-white/90 backdrop-blur-md p-2 rounded-full text-luxury-ink/60 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                )}
              </div>
              {product.status === 'pending' && (
                <div className="absolute bottom-3 left-3 bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Pending Review</div>
              )}
              {product.status === 'sold' && (
                <div className="absolute inset-0 bg-luxury-ink/30 flex items-center justify-center"><span className="bg-white text-luxury-ink px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest">Sold</span></div>
              )}
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">{product.category}</span>
              <span className="text-lg font-serif font-bold text-luxury-ink">₹{product.price}</span>
            </div>
            <h3 className="text-base font-bold text-luxury-ink">{product.title}</h3>
          </div>
        ))}

        {displayedListings.length === 0 && (
          <div className="col-span-full bg-white/50 rounded-2xl p-12 text-center border-2 border-dashed border-luxury-ink/10">
            <p className="text-luxury-ink/30 font-serif italic text-lg">No {activeTab} listings.</p>
          </div>
        )}

        {activeTab === 'active' && isOwnProfile && (
          <Link to="/sell" className="border-2 border-dashed border-luxury-ink/10 rounded-2xl flex flex-col items-center justify-center p-10 hover:border-brand-teal hover:bg-brand-teal/5 transition-all group">
            <div className="w-14 h-14 bg-luxury-ink/5 rounded-xl flex items-center justify-center mb-3 group-hover:bg-brand-teal transition-all">
              <Package className="text-luxury-ink/20 group-hover:text-white" size={28} />
            </div>
            <p className="text-sm font-bold text-luxury-ink">Add New Listing</p>
          </Link>
        )}
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-luxury-ink/20 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-md p-8 relative shadow-2xl border border-luxury-ink/5">
              <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 p-2 text-luxury-ink/40 hover:text-luxury-ink"><X size={20} /></button>
              <h3 className="text-xl font-bold text-luxury-ink mb-2">Edit Profile</h3>
              <p className="text-xs font-bold uppercase tracking-widest text-luxury-ink/40 mb-6">Update your public information.</p>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-teal/40 ml-1">Display Name</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required maxLength={100}
                    className="w-full bg-surface-base border border-luxury-ink/5 rounded-xl py-4 px-6 focus:outline-none focus:border-brand-teal text-sm font-medium" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-teal/40 ml-1">About Me (Optional)</label>
                  <textarea value={editAbout} onChange={(e) => setEditAbout(e.target.value)} rows={4} maxLength={500} placeholder="Share something about yourself..."
                    className="w-full bg-surface-base border border-luxury-ink/5 rounded-xl py-4 px-6 focus:outline-none focus:border-brand-teal text-sm font-medium resize-none" />
                </div>
                <button type="submit" className="w-full py-4 bg-brand-teal text-white text-[11px] font-bold uppercase tracking-[0.2em] shadow-lg hover:bg-brand-pink transition-colors rounded-xl">
                  Save Changes
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
