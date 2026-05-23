import { motion } from 'motion/react';
import { MapPin, Truck, ChevronRight, Sparkles, ShieldCheck, Upload, Image as ImageIcon, X, Link as LinkIcon } from 'lucide-react';
import React, { useState } from 'react';
import { categories } from '../../mockData';
import { useAuth } from '../../lib/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../lib/ToastContext';
import { uploadProductImage } from '../../lib/storage';
import { isHeicFile, convertHeicToJpeg } from '../../lib/heic-converter';

export default function SellItem() {
  interface SelectedImage {
    id: string;
    type: 'file' | 'url';
    file?: File;
    previewUrl: string;
  }

  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    category: 'Books',
    condition: 'Like New',
    description: '',
    meetup: true,
    delivery: false
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - selectedImages.length;
    if (remainingSlots <= 0) {
      showToast('Maximum of 5 images allowed', 'warning');
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      showToast(`Only adding the first ${remainingSlots} images to stay within the 5 image limit.`, 'info');
    }

    const newImages: SelectedImage[] = [];

    for (let f of Array.from(filesToProcess)) {
      let file = f as File;
      const isHeic = isHeicFile(file);
      const isStandardImage = file.type.startsWith('image/');

      if (!isHeic && !isStandardImage) {
        showToast(`"${file.name}" is not a recognized image file`, 'warning');
        continue;
      }

      if (isHeic) {
        showToast(`Converting "${file.name}" from HEIC...`, 'info');
        file = await convertHeicToJpeg(file);
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast(`"${file.name}" is over 5MB`, 'warning');
        continue;
      }

      newImages.push({
        id: Math.random().toString(36).substring(2, 9),
        type: 'file',
        file,
        previewUrl: URL.createObjectURL(file)
      });
    }

    setSelectedImages(prev => [...prev, ...newImages]);
  };

  const handleAddUrl = () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      showToast('Please enter a valid absolute URL (starting with http:// or https://)', 'warning');
      return;
    }

    if (selectedImages.length >= 5) {
      showToast('Maximum of 5 images allowed', 'warning');
      return;
    }

    const newImage: SelectedImage = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'url',
      previewUrl: trimmedUrl
    };

    setSelectedImages(prev => [...prev, newImage]);
    setUrlInput('');
  };

  const removeImage = (id: string) => {
    const imageToRemove = selectedImages.find(img => img.id === id);
    if (imageToRemove?.type === 'file') {
      URL.revokeObjectURL(imageToRemove.previewUrl);
    }
    setSelectedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) { showToast('Must be logged in.', 'warning'); return; }
    if (!userData.verified && !userData.isAdmin) { showToast('Only verified users can sell items.', 'warning'); return; }

    const titleTrimmed = formData.title.trim();
    const priceNum = Number(formData.price);

    if (titleTrimmed.length < 3) { showToast('Title must be at least 3 characters.', 'warning'); return; }
    if (isNaN(priceNum) || priceNum < 1) { showToast('Price must be at least ₹1.', 'warning'); return; }
    if (priceNum > 100000) { showToast('Price cannot exceed ₹1,00,000.', 'warning'); return; }

    if (selectedImages.length === 0) {
      showToast('Please add at least one product image.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      showToast('Processing listing images...', 'info');

      // Upload files in parallel using Promise.all
      const uploadPromises = selectedImages.map(async (img) => {
        if (img.type === 'file' && img.file) {
          return await uploadProductImage(img.file, user.uid);
        }
        return img.previewUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);

      await addDoc(collection(db, 'products'), {
        sellerId: user.uid,
        sellerName: userData.name,
        sellerSchool: userData.school,
        title: titleTrimmed,
        price: priceNum,
        condition: formData.condition,
        category: formData.category,
        image: imageUrls[0], // primary / legacy fallback
        images: imageUrls, // all listing images
        description: formData.description,
        meetupAvailable: formData.meetup,
        deliveryAvailable: formData.delivery,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      showToast('Listing submitted for admin review!', 'success');
      navigate('/dashboard');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products');
      showToast('Failed to create listing', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* Left: Form */}
        <div className="space-y-10">
          <div>
            <h1 className="text-5xl font-serif font-bold text-luxury-ink mb-4 italic">List Your <span className="not-italic">Asset.</span></h1>
            <p className="text-luxury-ink/50 font-medium">Create a premium listing for the Nextbench community.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Image upload section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40 ml-1">Product Pictures ({selectedImages.length}/5)</label>
                <div className="flex bg-surface-base rounded-lg p-0.5 ml-auto">
                  <button type="button" onClick={() => setUploadMode('upload')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${uploadMode === 'upload' ? 'bg-surface-card text-brand-teal shadow-sm' : 'text-luxury-ink/30'}`}>
                    Upload
                  </button>
                  <button type="button" onClick={() => setUploadMode('url')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${uploadMode === 'url' ? 'bg-surface-card text-brand-teal shadow-sm' : 'text-luxury-ink/30'}`}>
                    URL
                  </button>
                </div>
              </div>

              {/* Grid of selected / uploaded images */}
              {selectedImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  {selectedImages.map((img, idx) => (
                    <motion.div layout key={img.id} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-luxury-ink/5 border border-brand-teal/10 group shadow-sm">
                      <img src={img.previewUrl} alt={`Product preview ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <div className="absolute top-3 left-3 bg-brand-teal text-white px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider shadow-sm">
                          Cover
                        </div>
                      )}
                      <button type="button" onClick={() => removeImage(img.id)} className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-red-50 hover:text-red-500 transition-all opacity-100 sm:opacity-0 group-hover:opacity-100">
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                  {selectedImages.length < 5 && uploadMode === 'upload' && (
                    <label className="group relative border-2 border-dashed border-luxury-ink/10 rounded-2xl aspect-[4/3] flex flex-col items-center justify-center p-4 transition-all hover:border-brand-teal hover:bg-brand-teal/5 cursor-pointer">
                      <input type="file" accept="image/*,.heic,.heif" multiple onChange={handleFileSelect} className="hidden" />
                      <Upload className="text-luxury-ink/20 group-hover:text-brand-teal transition-colors" size={24} />
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-luxury-ink/40 text-center">Add More</p>
                    </label>
                  )}
                </div>
              )}

              {/* Main upload dropzone when list is empty */}
              {selectedImages.length === 0 && uploadMode === 'upload' && (
                <div className="relative">
                  <label className="group relative border-2 border-dashed border-luxury-ink/10 rounded-2xl p-12 transition-all hover:border-brand-teal hover:bg-brand-teal/5 cursor-pointer block">
                    <input type="file" accept="image/*,.heic,.heif" multiple onChange={handleFileSelect} className="hidden" />
                    <div className="flex flex-col items-center">
                      <Upload className="text-luxury-ink/20 group-hover:text-brand-teal transition-colors" size={40} />
                      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-luxury-ink/40">Drop images or click to browse</p>
                      <p className="mt-1 text-[10px] text-luxury-ink/20">Max 5 images • Max 5MB each • JPG, PNG, HEIC, WebP</p>
                    </div>
                  </label>
                </div>
              )}

              {/* URL Input */}
              {uploadMode === 'url' && (
                <div className="space-y-3">
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                      <LinkIcon size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-luxury-ink/30" />
                      <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }} placeholder="https://image-url.com/image.jpg..."
                        className="w-full bg-surface-card border border-luxury-ink/5 rounded-2xl py-4 pl-13 pr-4 luxury-shadow focus:outline-none focus:border-brand-teal transition-all text-sm font-medium" />
                    </div>
                    <button type="button" onClick={handleAddUrl} disabled={selectedImages.length >= 5}
                      className="px-6 bg-luxury-ink text-surface-base hover:bg-brand-teal transition-all rounded-2xl text-xs font-bold uppercase tracking-widest disabled:opacity-50">
                      Add
                    </button>
                  </div>
                  <p className="text-[10px] text-luxury-ink/30 ml-1">Type an absolute image URL and click Add (Max 5 URLs).</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40 ml-1">Item Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g., HC Verma Vol 1" required maxLength={100}
                  className="w-full bg-surface-card border border-luxury-ink/5 rounded-2xl py-4 px-6 luxury-shadow focus:outline-none focus:border-brand-teal transition-all text-sm font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40 ml-1">Desired Price (₹)</label>
                <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} placeholder="500" required min="1" max="100000"
                  className="w-full bg-surface-card border border-luxury-ink/5 rounded-2xl py-4 px-6 luxury-shadow focus:outline-none focus:border-brand-teal transition-all text-sm font-medium" />
                <p className="text-[10px] text-luxury-ink/30 mt-1 ml-1">₹1 – ₹1,00,000</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40 ml-1">Category</label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-surface-card border border-luxury-ink/5 rounded-2xl py-4 px-6 luxury-shadow focus:outline-none focus:border-brand-teal transition-all text-sm font-medium appearance-none">
                  {categories.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40 ml-1">Condition</label>
                <select value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})}
                  className="w-full bg-surface-card border border-luxury-ink/5 rounded-2xl py-4 px-6 luxury-shadow focus:outline-none focus:border-brand-teal transition-all text-sm font-medium appearance-none">
                  <option>Brand New</option><option>Like New</option><option>Good</option><option>Used</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40 ml-1">Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Describe the condition, history, and usage details..." rows={4} maxLength={2000}
                className="w-full bg-surface-card border border-luxury-ink/5 rounded-2xl py-5 px-6 luxury-shadow focus:outline-none focus:border-brand-teal transition-all text-sm font-medium resize-none" />
              <p className="text-[10px] text-luxury-ink/30 mt-1 ml-1 text-right">{formData.description.length}/2000</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onClick={() => setFormData({...formData, meetup: !formData.meetup})}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${formData.meetup ? 'border-brand-teal bg-brand-teal/5' : 'border-luxury-ink/5 bg-surface-card'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.meetup ? 'bg-brand-teal text-white' : 'bg-surface-soft text-luxury-ink/20'}`}><MapPin size={20} /></div>
                <div><p className="text-sm font-bold text-luxury-ink">School Meetup</p><p className="text-[10px] uppercase font-bold tracking-widest text-luxury-ink/30">Official points</p></div>
              </div>
              <div onClick={() => setFormData({...formData, delivery: !formData.delivery})}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${formData.delivery ? 'border-brand-pink bg-brand-pink/5' : 'border-luxury-ink/5 bg-surface-card'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.delivery ? 'bg-brand-pink text-white' : 'bg-surface-soft text-luxury-ink/20'}`}><Truck size={20} /></div>
                <div><p className="text-sm font-bold text-luxury-ink">Local Delivery</p><p className="text-[10px] uppercase font-bold tracking-widest text-luxury-ink/30">Porter / Instamart</p></div>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-luxury-ink text-surface-base py-5 rounded-2xl font-bold text-base hover:bg-brand-teal transition-all luxury-shadow active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? 'Publishing...' : 'Submit for Review'} <ChevronRight size={20} />
            </button>

            <p className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/20 text-center">
              Your listing will be reviewed by an admin before going live.
            </p>
          </form>
        </div>

        {/* Right: Live Preview */}
        <div className="hidden lg:sticky lg:top-32 lg:block">
          <div className="mb-6">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/30 mb-2">Live Preview</h4>
          </div>
          <div className="bg-surface-card rounded-2xl overflow-hidden luxury-shadow border border-luxury-ink/5 p-4 max-w-sm">
            <div className="aspect-[4/3] rounded-xl bg-luxury-ink/5 overflow-hidden flex items-center justify-center relative mb-5">
              {selectedImages.length > 0 ? (
                <div className="relative w-full h-full">
                  <img src={selectedImages[0].previewUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  {selectedImages.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      {selectedImages.map((_, idx) => (
                        <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === 0 ? 'bg-surface-card scale-125' : 'bg-white/40'}`} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Sparkles className="text-luxury-ink/10" size={48} />
              )}
              <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-brand-teal">
                {formData.condition}
              </div>
            </div>
            <div className="px-2 pb-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40">{formData.category}</p>
                <p className="text-xl font-serif font-bold text-luxury-ink">₹{formData.price || '0'}</p>
              </div>
              <h3 className="text-lg font-bold text-luxury-ink mb-5">{formData.title || 'Untitled Listing'}</h3>
              <div className="flex items-center gap-3 border-t border-luxury-ink/5 pt-5">
                <div className="w-9 h-9 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-serif font-bold text-sm">
                  {userData?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-xs font-bold text-luxury-ink">{userData?.name || 'You'}</p>
                  <p className="text-[10px] font-medium text-luxury-ink/30 tracking-wider flex items-center gap-1">
                    <ShieldCheck size={10} className="text-brand-teal" /> {userData?.school || 'Your School'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
