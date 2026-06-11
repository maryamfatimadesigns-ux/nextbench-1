/**
 * MessageReactions.tsx
 * Drop into src/components/ui/MessageReactions.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Plus } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReactionsMap = Record<string, string[]>;

interface MessageReactionsProps {
  reactions?: ReactionsMap;
  messageId: string;
  roomId: string;
  currentUserId: string;
  isMe: boolean;
  collectionPath?: 'chatRooms' | 'clubs';
  /** Controlled: is the quick-bar / picker open for this message? */
  isOpen: boolean;
  /** Controlled: call with true to open, false to close */
  onOpenChange: (open: boolean) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  },
  {
    label: 'Gestures',
    emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','👀','👁','👅','👄','💋'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  },
  {
    label: 'Animals',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🦅','🦆','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮'],
  },
  {
    label: 'Food',
    emojis: ['🍎','🍊','🍋','🍇','🍓','🍒','🍑','🥭','🍍','🥝','🍅','🥑','🍆','🥦','🌽','🥕','🧅','🧄','🥔','🍠','🍞','🥐','🥖','🫓','🧀','🥚','🍳','🧇','🥞','🧈','🍖','🍗','🥩','🥓','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🍿','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🍶','🍾','🍷','🍸','🍹','🍺','🍻','🥂','🥃'],
  },
  {
    label: 'Objects',
    emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥍','🏏','🪃','🥅','⛳','🪁','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🎮','🎲','♟','🎭','🎨','🖼','🎪','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🎬','📱','💻','⌨️','🖥','🖨','🖱','💾','💿','📀','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏱','⏰','⏳','📡','🔋','🔌','💡','🔦','🕯','🪔','🧯','💰','💴','💵','💶','💷','💸','💳','🪙','💎','⚖️','🔧','🔨','⚒','🛠','⛏','🔩','🪛','💣','🪓','🔪','🗡','⚔️','🛡','🪚'],
  },
];

// ─── Firestore helper ────────────────────────────────────────────────────────

async function toggleReaction(
  emoji: string,
  messageId: string,
  roomId: string,
  userId: string,
  currentReactions: ReactionsMap,
  collectionPath: 'chatRooms' | 'clubs'
) {
  const msgRef = doc(db, collectionPath, roomId, 'messages', messageId);
  const existing = currentReactions[emoji] || [];
  const hasReacted = existing.includes(userId);

  const updated: ReactionsMap = { ...currentReactions };

  if (hasReacted) {
    const next = existing.filter(id => id !== userId);
    if (next.length === 0) {
      delete updated[emoji];
    } else {
      updated[emoji] = next;
    }
  } else {
    updated[emoji] = [...existing, userId];
  }

  await updateDoc(msgRef, { reactions: updated });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MessageReactions({
  reactions = {},
  messageId,
  roomId,
  currentUserId,
  isMe,
  collectionPath = 'chatRooms',
  isOpen,
  onOpenChange,
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const totalReactions = Object.values(reactions).reduce((sum, uids) => sum + uids.length, 0);
  const hasReactions = totalReactions > 0;

  // Close everything when isOpen goes false from parent
  useEffect(() => {
    if (!isOpen) {
      setShowPicker(false);
    }
  }, [isOpen]);

  // Click-outside closes quick bar AND full picker
  useEffect(() => {
    if (!isOpen && !showPicker) return;

    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideContainer = containerRef.current?.contains(target);
      const insidePicker = pickerRef.current?.contains(target);
      if (!insideContainer && !insidePicker) {
        onOpenChange(false);
        setShowPicker(false);
      }
    };

    // slight delay so the click that opened it doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handle);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handle);
    };
  }, [isOpen, showPicker, onOpenChange]);

  const handleQuickEmoji = async (emoji: string) => {
    await toggleReaction(emoji, messageId, roomId, currentUserId, reactions, collectionPath);
    onOpenChange(false);
  };

  const handlePickerEmoji = async (emoji: string) => {
    await toggleReaction(emoji, messageId, roomId, currentUserId, reactions, collectionPath);
    setShowPicker(false);
    onOpenChange(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}
    >
      {/* ── Existing reaction bubbles ── */}
      {hasReactions && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          {Object.entries(reactions).map(([emoji, uids]) => {
            if (uids.length === 0) return null;
            const iReacted = uids.includes(currentUserId);
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji, messageId, roomId, currentUserId, reactions, collectionPath)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-all hover:scale-110 active:scale-95 ${
                  iReacted
                    ? 'bg-brand-teal/15 border-brand-teal/40 shadow-sm'
                    : 'bg-surface-card border-luxury-ink/10 hover:border-brand-teal/30'
                }`}
              >
                <span>{emoji}</span>
                {uids.length > 1 && (
                  <span className={`text-[10px] font-bold ${iReacted ? 'text-brand-teal' : 'text-luxury-ink/50'}`}>
                    {uids.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Quick emoji bar (controlled by isOpen) ── */}
      <AnimatePresence>
        {isOpen && !showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 6 }}
            transition={{ duration: 0.15 }}
            className={`flex items-center gap-1 bg-surface-card border border-luxury-ink/10 rounded-full px-3 py-2 shadow-xl z-50 ${
              isMe ? 'self-end' : 'self-start'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => handleQuickEmoji(emoji)}
                className={`text-xl p-1 rounded-full hover:bg-surface-soft hover:scale-125 transition-all active:scale-95 ${
                  (reactions[emoji] || []).includes(currentUserId) ? 'bg-brand-teal/10' : ''
                }`}
              >
                {emoji}
              </button>
            ))}
            {/* + button → full picker */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPicker(true);
              }}
              className="p-1.5 rounded-full bg-surface-soft hover:bg-brand-teal/10 hover:text-brand-teal transition-all text-luxury-ink/40"
            >
              <Plus size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full emoji picker (portal-like, fixed position) ── */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ duration: 0.18 }}
            className={`fixed z-200 bottom-24 ${isMe ? 'right-4' : 'left-4'} w-[320px] bg-surface-card border border-luxury-ink/10 rounded-2xl shadow-2xl overflow-hidden`}
            onClick={e => e.stopPropagation()}
          >
            {/* Tab bar */}
            <div className="flex gap-1 p-2 border-b border-luxury-ink/5 overflow-x-auto no-scrollbar">
              {EMOJI_GROUPS.map((group, idx) => (
                <button
                  key={group.label}
                  onClick={() => setPickerTab(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    pickerTab === idx
                      ? 'bg-brand-teal/15 text-brand-teal'
                      : 'text-luxury-ink/40 hover:bg-surface-soft'
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="p-3 h-48 overflow-y-auto">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_GROUPS[pickerTab].emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handlePickerEmoji(emoji)}
                    className={`text-xl p-1.5 rounded-lg hover:bg-surface-soft hover:scale-125 transition-all active:scale-95 ${
                      (reactions[emoji] || []).includes(currentUserId) ? 'bg-brand-teal/10' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}