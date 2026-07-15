import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { Message } from '../../hooks/useChatEngine';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  loadOlder: () => void;
  markAsRead: () => void;
  user: any;
  isClub: boolean;
  isMember: boolean;
  isAdmin: boolean;
  collectionPath: 'chatRooms' | 'clubs';
  roomId: string;
  onPin?: (msgId: string, text?: string) => void;
  showLightbox: (urls: string[]) => void;
  resendMessage: (tempId: string) => void;
  removeFailedMessage: (tempId: string) => void;
  // context-menu + selection wiring (state owned by ChatView)
  isSelectMode: boolean;
  selectedMessages: Set<string>;
  toggleMessageSelection: (msgId: string) => void;
  activeReactionMsgId: string | null;
  setActiveReactionMsgId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedMessageId: string | null;
  setSelectedMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setMenuPosition: React.Dispatch<React.SetStateAction<{ top?: number; bottom?: number; left?: number; right?: number } | null>>;
  replyingTo: Message | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<Message | null>>;
  setDeleteConfirmMsgId: React.Dispatch<React.SetStateAction<string | null>>;
  setDeleteEveryoneConfirmMsgId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function MessageList({
  messages,
  loading,
  hasMore,
  loadOlder,
  markAsRead,
  user,
  isClub,
  isMember,
  isAdmin,
  collectionPath,
  roomId,
  onPin,
  showLightbox,
  resendMessage,
  removeFailedMessage,
  isSelectMode,
  selectedMessages,
  toggleMessageSelection,
  activeReactionMsgId,
  setActiveReactionMsgId,
  selectedMessageId,
  setSelectedMessageId,
  setMenuPosition,
  replyingTo,
  setReplyingTo,
  setDeleteConfirmMsgId,
  setDeleteEveryoneConfirmMsgId,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  // Throttle markAsRead to prevent write→read→render feedback loops in club chats
  const lastMarkAsReadRef = useRef<number>(0);
  // Track the last-seen message ID to distinguish new messages from loaded-older ones
  const lastMsgIdRef = useRef<string | undefined>(undefined);

  // Mark chat as read — throttled to at most once per 2 s to prevent write→read→render loops
  useEffect(() => {
    if (!isNearBottom || messages.length === 0) return;
    const now = Date.now();
    if (now - lastMarkAsReadRef.current < 2000) return;
    lastMarkAsReadRef.current = now;
    markAsRead();
  }, [messages.length, isNearBottom, markAsRead]);

  // Track scroll position
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollOffsetFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setIsNearBottom(scrollOffsetFromBottom <= 80);

    if (scrollOffsetFromBottom <= 80) {
      setNewMessageCount(0);
    }

    // Trigger loadOlder
    if (target.scrollTop <= 80 && hasMore && !loading) {
      prevScrollHeightRef.current = target.scrollHeight;
      prevScrollTopRef.current = target.scrollTop;
      loadOlder();
    }
  };

  // Adjust scroll when history loads
  useEffect(() => {
    if (parentRef.current && prevScrollHeightRef.current > 0) {
      const scrollDiff = parentRef.current.scrollHeight - prevScrollHeightRef.current;
      if (scrollDiff > 0) {
        parentRef.current.scrollTop = prevScrollTopRef.current + scrollDiff;
      }
      prevScrollHeightRef.current = 0;
    }
  }, [messages.length]);

  // Scroll to bottom on genuinely new messages only (not when loading older history)
  const lastMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    const latestMsg = messages[messages.length - 1];
    const latestMsgId = latestMsg?.id;

    // Only scroll when a new message was appended at the bottom.
    // Comparing IDs prevents false-triggering when older messages are prepended
    // (load-older: length grows but latestMsgId stays the same).
    const isNewMessageAppended =
      messages.length > lastMessagesLengthRef.current && latestMsgId !== lastMsgIdRef.current;

    if (isNewMessageAppended) {
      const isMine = latestMsg?.senderId === user?.uid;
      if (isNearBottom || isMine) {
        setTimeout(() => {
          if (parentRef.current) {
            parentRef.current.scrollTop = parentRef.current.scrollHeight;
          }
        }, 50);
        setNewMessageCount(0);
      } else {
        setNewMessageCount((prev) => prev + 1);
      }
    }

    lastMessagesLengthRef.current = messages.length;
    lastMsgIdRef.current = latestMsgId;
  }, [messages, user?.uid, isNearBottom]);

  return (
    <>
      {/* Messages Scroll Area */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        {messages.length === 0 && !loading && (
          <div className="text-center py-20">
            {isClub && !isMember ? (
              <>
                <p className="text-luxury-ink/20 font-serif italic text-lg mb-2">Join this club to view messages</p>
                <p className="text-luxury-ink/10 text-xs font-bold uppercase tracking-widest">Members can see the conversation here</p>
              </>
            ) : (
              <>
                <p className="text-luxury-ink/20 font-serif italic text-lg mb-2">Start the conversation</p>
                <p className="text-luxury-ink/10 text-xs font-bold uppercase tracking-widest">Messages are encrypted and secure</p>
              </>
            )}
          </div>
        )}

        {loading && messages.length === 0 && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`w-2/3 h-12 bg-surface-soft rounded-2xl animate-pulse`} />
              </div>
            ))}
          </div>
        )}

        {/* Message List Container */}
        <div className="space-y-3.5">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              user={user}
              isSelectMode={isSelectMode}
              isSelected={selectedMessages.has(msg.id)}
              toggleMessageSelection={toggleMessageSelection}
              activeReactionMsgId={activeReactionMsgId}
              setActiveReactionMsgId={setActiveReactionMsgId}
              selectedMessageId={selectedMessageId}
              setSelectedMessageId={setSelectedMessageId}
              setMenuPosition={setMenuPosition}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              setDeleteConfirmMsgId={setDeleteConfirmMsgId}
              setDeleteEveryoneConfirmMsgId={setDeleteEveryoneConfirmMsgId}
              onPin={onPin}
              collectionPath={collectionPath}
              roomId={roomId}
              showLightbox={showLightbox}
              resendMessage={resendMessage}
              removeFailedMessage={removeFailedMessage}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </div>

      {/* Floating Scroll Count Button */}
      {newMessageCount > 0 && (
        <button
          onClick={() => {
            if (parentRef.current) {
              parentRef.current.scrollTop = parentRef.current.scrollHeight;
            }
            setNewMessageCount(0);
          }}
          className="absolute bottom-24 right-6 z-30 flex items-center gap-2 bg-luxury-ink text-surface-base px-4 py-2.5 rounded-full shadow-2xl hover:bg-brand-teal transition-all text-xs font-bold uppercase tracking-wider animate-bounce"
        >
          <ArrowDown size={14} />
          {newMessageCount} new message{newMessageCount > 1 ? 's' : ''}
        </button>
      )}
    </>
  );
}
