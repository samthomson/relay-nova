import React from 'react';
import { LoginArea } from '@/components/auth/LoginArea';
import { MyRelaysButton } from '@/components/MyRelaysButton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { User } from 'lucide-react';

export function Navbar() {
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey || '');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand on the left */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-white">
              Relay Nova
            </h1>
          </div>

          {/* Right side - Authentication and Debug Info */}
          <div className="flex items-center space-x-4">
            {/* Debug Info */}
            <div className="text-xs text-gray-300">
              {user ? (
                <div className="flex items-center space-x-2">
                  <User className="w-3 h-3" />
                  <span>Logged in: {author.data?.metadata?.name || user.pubkey?.slice(0, 8) + '...'}</span>
                </div>
              ) : (
                <span>Not logged in</span>
              )}
            </div>

            <LoginArea className="max-w-60" />
            {user && <MyRelaysButton />}
          </div>
        </div>
      </div>
    </nav>
  );
}