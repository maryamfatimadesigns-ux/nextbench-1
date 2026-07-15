import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowDown, Pin } from 'lucide-react';

import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';
import { useLightbox } from '../../lib/LightboxContext';

import { useChatEngine, Message } from '../../hooks/useChatEngine';
import { MessageBubble } from './MessageBubble';
import { MessageContextMenu } from './MessageContextMenu';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';

interface ChatViewProps {
  collectionPath: 'chatRooms' | 'clubs';
  roomId: string;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  isBlocked?: boolean;
  isMember?: boolean;
  isAdmin?: boolean;
  canPost?: boolean;
  clubMembers?: string[];
  otherUser?: any;
  otherPresence?: any;
  onBack?: () => void;
  // Options
  showOptions?: boolean;
  setShowOptions?: (show: boolean) => void;
  showReport?: boolean;
  setShowReport?: (show: boolean) => void;
  recipientId?: string;
  pinnedMessageText?: string | null;
  onUnpin?: () => void;
  onPin?: (msgId: string, text?: string) => void;
}

export default function ChatView({
  collectionPath,
  roomId,
  title,
  subtitle,
  avatar,
  isBlocked = false,
  isMember = true,
  isAdmin = false,
  canPost = true,
  clubMembers,
  otherUser,
  otherPresence,
  onBack,
  showOptions = false,
  setShowOptions,
  showReport = false,
  setShowReport,
  recipientId,
  pinnedMessageText,
  onUnpin,
  onPin,
}: ChatViewProps) {
  const { user, userData } = useAuth();
  const { showToast } = useToast();
  const { showLightbox } = useLightbox();

  const isClub = collectionPath === 'clubs';
  const canLoadMessages = !isClub || isMember;

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [deleteConfirmMsgId, setDeleteConfirmMsgId] = useState<string | null>(null);
  const [deleteEveryoneConfirmMsgId, setDeleteEveryoneConfirmMsgId] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);

  // Message Info state
  const [msgInfoId, setMsgInfoId] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  // Throttle markAsRead to prevent write→read→render feedback loops in club chats
  const lastMarkAsReadRef = useRef<number>(0);
  // Track the last-seen message ID to distinguish new messages from loaded-older ones
  const lastMsgIdRef = useRef<string | undefined>(undefined);

  const {
    messages,
    loading,
    hasMore,
    loadOlder,
    sendMessage,
    resendMessage,
    removeFailedMessage,
    deleteForMe,
    deleteForEveryone,
    sendVoiceMessage,
    markAsRead,
  } = useChatEngine({
    collectionPath,
    roomId,
    user,
    userData,
    recipientId,
    isBlocked,
    clubMembers,
    enabled: canLoadMessages,
  });

  // Mark chat as read — throttled to at most once per 2 s to prevent write→read→render loops
  useEffect(() => {
    if (!isNearBottom || messages.length === 0) return;
    const now = Date.now();
    if (now - lastMarkAsReadRef.current < 2000) return;
    lastMarkAsReadRef.current = now;
    markAsRead();
  }, [messages.length, isNearBottom, markAsRead]);

  // Virtualizer removed for better typing performance and zero rendering lag

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

  // Selection & deletion handlers
  const toggleMessageSelection = useCallback((msgId: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedMessages.size === 0) return;
    if (!confirm(`Delete ${selectedMessages.size} messages?`)) return;

    try {
      await Promise.all(Array.from(selectedMessages).map((id) => deleteForMe(id)));
      showToast('Messages deleted', 'success');
      setSelectedMessages(new Set());
      setIsSelectMode(false);
    } catch {
      showToast('Failed to delete messages', 'error');
    }
  };

  const handleCopyMessageText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-base relative">
      {/* Header */}
      <ChatHeader
        collectionPath={collectionPath}
        roomId={roomId}
        title={title}
        subtitle={subtitle}
        avatar={avatar}
        otherUser={otherUser}
        otherPresence={otherPresence}
        recipientId={recipientId}
        onBack={onBack}
        showOptions={showOptions}
        setShowOptions={setShowOptions}
        isSelectMode={isSelectMode}
        selectedCount={selectedMessages.size}
        onBulkDelete={handleBulkDelete}
        onCancelSelect={() => { setIsSelectMode(false); setSelectedMessages(new Set()); }}
      />

      {/* Pinned Message Banner */}
      {pinnedMessageText && (
        <div className="bg-surface-soft border-b px-6 py-2.5 flex items-center justify-between z-10 relative" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 overflow-hidden">
            <Pin size={14} className="text-brand-teal shrink-0" />
            <div className="text-xs font-semibold text-luxury-ink/75 truncate">{pinnedMessageText}</div>
          </div>
          {onUnpin && (
            <button onClick={onUnpin} className="p-1 hover:bg-surface-base rounded-full transition-colors shrink-0 ml-2 cursor-pointer">
              <X size={14} className="text-luxury-ink/40" />
            </button>
          )}
        </div>
      )}

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

      {/* Input Composer Footer Panel */}
      <Composer
        collectionPath={collectionPath}
        roomId={roomId}
        isBlocked={isBlocked}
        isMember={isMember}
        canPost={canPost}
        user={user}
        userData={userData}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        sendMessage={sendMessage}
        sendVoiceMessage={sendVoiceMessage}
      />

      <MessageContextMenu
        messages={messages}
        user={user}
        isClub={isClub}
        isAdmin={isAdmin}
        onPin={onPin}
        selectedMessageId={selectedMessageId}
        setSelectedMessageId={setSelectedMessageId}
        menuPosition={menuPosition}
        setReplyingTo={setReplyingTo}
        setIsSelectMode={setIsSelectMode}
        toggleMessageSelection={toggleMessageSelection}
        msgInfoId={msgInfoId}
        setMsgInfoId={setMsgInfoId}
        deleteConfirmMsgId={deleteConfirmMsgId}
        setDeleteConfirmMsgId={setDeleteConfirmMsgId}
        deleteEveryoneConfirmMsgId={deleteEveryoneConfirmMsgId}
        setDeleteEveryoneConfirmMsgId={setDeleteEveryoneConfirmMsgId}
        deleteForMe={deleteForMe}
        deleteForEveryone={deleteForEveryone}
        onCopyText={handleCopyMessageText}
      />
    </div>
  );
}
