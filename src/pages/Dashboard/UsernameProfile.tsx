import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getUserIdByUsername } from '../../lib/usernames';
import Profile from './Profile';
import PageLoader from '../../components/ui/PageLoader';

/**
 * Resolves /:username param to a userId, then renders Profile.
 * Shows loading state while resolving, 404 if not found.
 */
export default function UsernameProfile() {
  const { username } = useParams<{ username: string }>();
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    
    const resolve = async () => {
      try {
        const userId = await getUserIdByUsername(username);
        if (cancelled) return;
        
        if (userId) {
          setResolvedUserId(userId);
        } else {
          setNotFound(true);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [username]);

  if (loading) {
    return <PageLoader />;
  }

  if (notFound) {
    return (
      <div className="pt-32 pb-20 px-6 max-w-lg mx-auto text-center">
        <div className="theme-card rounded-3xl p-16">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-2xl font-bold text-luxury-ink mb-3">User Not Found</h2>
          <p className="text-luxury-ink/50 text-sm mb-8">
            The username <span className="font-bold text-brand-teal">@{username}</span> doesn't exist on Nextbench.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-brand-teal text-white px-8 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-brand-pink transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Render Profile with the resolved userId
  return <Profile usernameResolvedUserId={resolvedUserId!} />;
}
