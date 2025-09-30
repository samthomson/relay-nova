import React from 'react';
import { LoginArea } from '@/components/auth/LoginArea';
import { MyRelaysButton } from '@/components/MyRelaysButton';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function Navbar() {
  const { user } = useCurrentUser();

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

          {/* Right side - Authentication */}
          <div className="flex items-center">
            {user ? (
              <MyRelaysButton />
            ) : (
              <LoginArea className="max-w-60" />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}