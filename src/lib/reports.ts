/**
 * Content Reporting System
 *
 * Collection: `reports`
 * Doc shape: { reporterId, contentType, contentId, reason, notes, status, createdAt }
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type ReportContentType = 'post' | 'product' | 'user' | 'message';

export type ReportReason = 
  | 'inappropriate'
  | 'harassment'
  | 'spam'
  | 'hate_speech'
  | 'violence'
  | 'self_harm'
  | 'misinformation'
  | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'harassment', label: 'Harassment or Bullying' },
  { id: 'spam', label: 'Spam' },
  { id: 'hate_speech', label: 'Hate Speech' },
  { id: 'violence', label: 'Violence or Threats' },
  { id: 'self_harm', label: 'Self-Harm or Dangerous Activities' },
  { id: 'misinformation', label: 'Misinformation' },
  { id: 'other', label: 'Other' },
];

/**
 * Submit a content report
 */
export async function reportContent(
  reporterId: string,
  contentType: ReportContentType,
  contentId: string,
  reason: ReportReason,
  notes?: string
): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    contentType,
    contentId,
    reason,
    notes: notes?.trim() || null,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}
