import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/**
 * Server-authoritative post creation.
 *
 * The post's `status` is decided by the backend (`functions/src/postPayload.ts`), never by this
 * client: `firestore.rules` no longer accepts an `approved` post written by a client. The fields
 * that identify the author (id, name, school) are also taken from the signed-in profile on the
 * server, so a modified bundle cannot post as somebody else.
 */
export interface PostSubmission {
  title: string;
  content: string;
  type: string;
  privacy?: string;
  isAnonymous?: boolean;
  personaName?: string | null;
  city?: string | null;
  imageUrls?: string[];
  imagesDetailed?: Array<{ url: string; w: number | null; h: number | null }>;
  imageWidth?: number | null;
  imageHeight?: number | null;
  pdfUrl?: string;
  pdfPages?: number | null;
  videoUrl?: string;
  poll?: { choices: string[]; expiresAt: number; votes: Record<string, number> };
}

export interface CreatedPost {
  id: string;
  status: 'approved' | 'pending';
  flagged: boolean;
  reason: string | null;
}

export async function submitPost(payload: PostSubmission): Promise<CreatedPost> {
  const callable = httpsCallable<{ post: PostSubmission }, Partial<CreatedPost>>(functions, 'submitPost');
  const response = await callable({ post: payload });
  const data = response.data ?? {};
  if (typeof data.id !== 'string' || !data.id) {
    throw new Error('The post could not be saved.');
  }
  return {
    id: data.id,
    status: data.status === 'approved' ? 'approved' : 'pending',
    flagged: data.flagged === true,
    reason: typeof data.reason === 'string' ? data.reason : null,
  };
}

/**
 * True when `submitPost` is not available in the deployed Functions build (or the deployment is
 * mid-rollout). Only this case falls back to a direct `pending` write; real validation, auth and
 * permission failures are reported to the user unchanged.
 */
export function submitPostIsUnavailable(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  return ['functions/not-found', 'functions/unimplemented', 'functions/internal']
    .some((marker) => code === marker || message.includes(marker.replace('functions/', '')))
    || /not found|not deployed|unimplemented/i.test(message);
}
