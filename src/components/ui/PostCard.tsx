import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageSquare, MapPin, Flame, Flag } from 'lucide-react';
import { motion } from 'motion/react';
import { getOptimizedImageUrl } from '../../lib/utils';
import { POST_TYPES } from '../../pages/Dashboard/Feed';
import ReportModal from './ReportModal';

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorProfilePicture?: string;
  authorUsername?: string;
  school: string;
  type: string;
  imageUrl?: string;
  imageUrls?: string[];
  upvotesCount: number;
  repliesCount: number;
  feedScore?: number;
  city?: string;
  createdAt: any;
}

interface PostCardProps {
  key?: React.Key;
  post: Post;
  hasUpvoted: boolean;
  onClick: () => void;
}

export default function PostCard({ post, hasUpvoted, onClick }: PostCardProps) {
  const postImageUrls = post.imageUrls && post.imageUrls.length > 0
    ? post.imageUrls
    : (post.imageUrl ? [post.imageUrl] : []);
  const hasImage = postImageUrls.length > 0;
  const [showReport, setShowReport] = useState(false);
  const navigate = useNavigate();

  const profileLink = post.authorUsername ? `/${post.authorUsername}` : `/profile/${post.authorId}`;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="post-card relative theme-card rounded-3xl overflow-hidden group hover:scale-[1.005] transition-all max-w-xl mx-auto w-full cursor-pointer"
        onClick={onClick}
      >
        {hasImage ? (
          <>
            {/* Image */}
            <div className="relative w-full aspect-square overflow-hidden bg-surface-soft">
              <img
                src={getOptimizedImageUrl(postImageUrls[0])}
                alt={post.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              {/* Hover stats overlay */}
              <div className="post-card-overlay flex items-center justify-center gap-8">
                <span className="flex items-center gap-2 text-white text-base font-bold">
                  <Heart size={28} className={hasUpvoted ? 'fill-white' : ''} /> {post.upvotesCount || 0}
                </span>
                <span className="flex items-center gap-2 text-white text-base font-bold">
                  <MessageSquare size={28} /> {post.repliesCount || 0}
                </span>
              </div>
              {/* Multi-image indicator */}
              {postImageUrls.length > 1 && (
                <div className="absolute top-4 right-4 bg-luxury-ink/40 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[10px] font-bold">
                  1/{postImageUrls.length}
                </div>
              )}
              {/* Trending badge */}
              {post.feedScore && post.feedScore > 10 && (
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/90 backdrop-blur-md text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-amber-500/20">
                    <Flame size={12} /> Hot
                  </span>
                </div>
              )}
            </div>

            {/* Always-visible caption bar */}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(profileLink); }} className="shrink-0 cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-brand-pink/10 flex items-center justify-center text-brand-pink font-bold text-lg font-serif overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
                    {post.authorProfilePicture ? (
                      <img src={getOptimizedImageUrl(post.authorProfilePicture)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : post.authorName[0]?.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(profileLink); }} className="text-base font-bold text-luxury-ink hover:text-brand-teal transition-colors cursor-pointer">
                    {post.authorName}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-luxury-ink/40">{post.school}</p>
                </div>
                <span className="ml-auto inline-flex items-center px-3 py-1 bg-brand-teal/10 text-brand-teal rounded-full text-[9px] font-bold uppercase tracking-widest shrink-0">
                  {POST_TYPES.find(t => t.id === post.type)?.label || post.type}
                </span>
              </div>
              <h3 className="text-[15px] font-bold text-luxury-ink leading-snug line-clamp-2">{post.title}</h3>
              <p className="text-luxury-ink/50 text-xs leading-relaxed line-clamp-1 mt-1.5">{post.content}</p>
              <div className="flex items-center gap-6 mt-5 text-luxury-ink/40">
                <span className="flex items-center gap-2 text-sm font-bold hover:text-brand-pink transition-colors">
                  <Heart size={22} className={hasUpvoted ? 'fill-brand-pink text-brand-pink' : ''} /> {post.upvotesCount || 0}
                </span>
                <span className="flex items-center gap-2 text-sm font-bold hover:text-brand-teal transition-colors">
                  <MessageSquare size={22} /> {post.repliesCount || 0}
                </span>
                {post.city && (
                  <span className="flex items-center gap-1.5 text-xs font-bold ml-auto">
                    <MapPin size={16} /> {post.city}
                  </span>
                )}
                {/* Report button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReport(true); }}
                  className="ml-auto p-1.5 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  title="Report"
                >
                  <Flag size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          // Text-only post card
          <div className="w-full p-8 flex flex-col h-full" style={{ background: `linear-gradient(135deg, var(--color-surface-card), var(--color-surface-soft))` }}>
            <div className="flex items-center gap-2 mb-6">
              <span className="inline-flex items-center px-3 py-1.5 bg-brand-teal/10 text-brand-teal rounded-xl text-[10px] font-bold uppercase tracking-widest">
                {POST_TYPES.find(t => t.id === post.type)?.label || post.type}
              </span>
              {post.feedScore && post.feedScore > 10 && (
                <span className="inline-flex items-center gap-1.5 text-amber-500 text-[10px] font-bold bg-amber-500/10 px-3 py-1.5 rounded-xl uppercase tracking-widest">
                  <Flame size={12} /> Hot
                </span>
              )}
              {/* Report button for text posts */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowReport(true); }}
                className="ml-auto p-1.5 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-all text-luxury-ink/20 opacity-0 group-hover:opacity-100"
                title="Report"
              >
                <Flag size={14} />
              </button>
            </div>
            <h3 className="text-xl font-serif font-bold text-luxury-ink leading-snug mb-4">{post.title}</h3>
            <div className="text-luxury-ink/70 text-[15px] leading-relaxed max-h-[300px] overflow-y-auto no-scrollbar mb-6 whitespace-pre-wrap">
              {post.content}
            </div>
            <div className="flex items-center justify-between mt-auto pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(profileLink); }} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-brand-pink/10 flex items-center justify-center text-brand-pink font-bold text-[13px] font-serif overflow-hidden border border-brand-pink/20">
                  {post.authorProfilePicture ? (
                    <img src={getOptimizedImageUrl(post.authorProfilePicture)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : post.authorName[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-sm font-bold text-luxury-ink block truncate">{post.authorName}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-luxury-ink/30 truncate">{post.school}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-luxury-ink/40">
                <span className="flex items-center gap-2 text-sm font-bold hover:text-brand-pink transition-colors">
                  <Heart size={22} className={hasUpvoted ? 'fill-brand-pink text-brand-pink' : ''} /> {post.upvotesCount || 0}
                </span>
                <span className="flex items-center gap-2 text-sm font-bold hover:text-brand-teal transition-colors">
                  <MessageSquare size={22} /> {post.repliesCount || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        contentType="post"
        contentId={post.id}
      />
    </>
  );
}
