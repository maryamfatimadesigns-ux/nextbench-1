import { ReactNode, Suspense } from 'react';
import SidebarNav from './SidebarNav';
import BottomNav from './BottomNav';
import MobileHeader from './MobileHeader';
import SuggestedUsers from '../ui/SuggestedUsers';
import { useAuth } from '../../lib/AuthContext';
import UsernameSetup from '../ui/UsernameSetup';
import { ShieldAlert } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

function CenterLoader() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="w-10 h-10 border-3 border-brand-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { userData } = useAuth();
  const location = useLocation();
  const needsUsername = !!(userData && userData.verified && !userData.username);
  const isClubPage = location.pathname.startsWith('/club');

  return (
    <div className="min-h-screen bg-surface-base font-sans text-luxury-ink relative">
      {userData && !userData.verified && (
        <div className="bg-brand-teal text-white px-4 py-3 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-3 z-50 relative">
          <ShieldAlert size={16} />
          <span>Your account is unverified. You can browse, but interactions are disabled.</span>
          <Link to="/verification" className="bg-white text-brand-teal px-3 py-1 rounded-full hover:bg-brand-pink hover:text-white transition-colors">
            Verify Now
          </Link>
        </div>
      )}
      
      <MobileHeader />
      {/* Centered Layout Container */}
      <div className="w-full flex justify-center relative z-10">
        
        <div className="flex w-full max-w-[1350px] min-w-0">
          
          {/* Left Sidebar (Now next to middle content) */}
          <div className={`hidden md:block shrink-0 border-r transition-all duration-300 ${
            isClubPage ? 'w-[72px]' : 'w-[72px] xl:w-[240px]'
          }`} style={{ borderColor: 'var(--color-border)' }}>
            <SidebarNav />
          </div>

          {/* Center Main Content — has its own Suspense so sidebar never flickers */}
          <main className="flex-1 min-w-0 md:border-r pb-20 md:pb-0" style={{ borderColor: 'var(--color-border)' }}>
            <Suspense fallback={<CenterLoader />}>
              {children}
            </Suspense>
          </main>

          {/* Right Sidebar (hidden on mobile and tablet) */}
          <div className="hidden lg:block w-[320px] xl:w-[380px] shrink-0">
            <SuggestedUsers />
          </div>
        </div>
      </div>

      {/* Bottom Nav for Mobile */}
      <BottomNav />
      
      {needsUsername && <UsernameSetup isOpen={true} mandatory={true} onClose={() => {}} />}
    </div>
  );
}
