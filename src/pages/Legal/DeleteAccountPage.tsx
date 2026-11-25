import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';

const LAST_UPDATED = 'November 25, 2026';
const CONTACT_EMAIL = 'nextbench@loreto.edu';

/**
 * Public account-deletion page.
 *
 * Google Play requires a web URL that explains how an account can be deleted, reachable without
 * installing or signing into the app. The in-app path (Profile → Settings → Delete account) performs
 * the deletion through the server-authoritative `requestAccountDeletion` callable; this page covers
 * users who no longer have the app installed.
 */
export default function DeleteAccountPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-luxury-ink/40 hover:text-brand-teal transition-colors mb-10"
      >
        <ArrowLeft size={14} /> Back to NextBench
      </Link>

      <div className="border-b border-luxury-ink/5 pb-8 mb-10">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold italic text-luxury-ink mb-3">
          Delete <span className="not-italic">your account</span>
        </h1>
        <p className="text-xs font-bold uppercase tracking-wider text-luxury-ink/40">
          Last Updated: {LAST_UPDATED}
        </p>
      </div>

      <div className="space-y-10 text-sm leading-relaxed text-luxury-ink/70">
        <p>
          You can delete your NextBench account at any time. Deletion is permanent: your profile,
          listings, posts and verification documents are removed and cannot be restored.
        </p>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-serif font-bold italic text-luxury-ink">
            <Smartphone size={18} className="text-brand-teal" /> Delete from the app
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Open NextBench and sign in with the account you want to delete.</li>
            <li>Go to <strong>You</strong> → <strong>Settings</strong>.</li>
            <li>Tap <strong>Delete account</strong>, type <code>DELETE</code> to confirm, and submit.</li>
            <li>If asked, sign in again so the request comes from a recent session.</li>
          </ol>
          <p>
            The request is processed by our servers immediately after confirmation; the app then
            signs you out.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-serif font-bold italic text-luxury-ink">
            <Mail size={18} className="text-brand-teal" /> Request deletion without the app
          </h2>
          <p>
            Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=Account%20deletion%20request`} className="text-brand-teal font-bold">
              {CONTACT_EMAIL}
            </a>{' '}
            from the email address linked to your NextBench account, with the subject
            "Account deletion request". We verify the request and complete verified deletions within
            30 days, then confirm by email.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-serif font-bold italic text-luxury-ink">
            <Trash2 size={18} className="text-brand-teal" /> What is deleted
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Your profile, username reservation, photo and Preferences.</li>
            <li>Your student ID card and selfie evidence, and organization registration documents.</li>
            <li>Your listings, wishlist items, stories, posts and replies where removal is permitted.</li>
            <li>Your club memberships, chat participation and saved content.</li>
            <li>Your push-notification tokens and sign-in account.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-serif font-bold italic text-luxury-ink">
            <ShieldCheck size={18} className="text-brand-teal" /> What we keep
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Moderation and safety records — reports you filed or that were filed about you, and
              product reviews — are retained so reports and bans stay enforceable. Your name is
              replaced with "Deleted user" where a record displays one; a report keeps the account
              id it was filed with so the moderation history stays intact.
            </li>
            <li>
              Completed transaction and payout records are retained for up to one year where required
              for dispute resolution and legal compliance.
            </li>
            <li>Messages you sent to other members remain in their conversations.</li>
          </ul>
          <p>
            Full detail is in our{' '}
            <Link to="/privacy" className="text-brand-teal font-bold">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
