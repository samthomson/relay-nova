import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Server } from 'lucide-react';
import { MyRelaysModal } from '@/components/MyRelaysModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function MyRelaysButton() {
  const { user } = useCurrentUser();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="text-white border-white/20 hover:bg-white/10 hover:border-white/30 transition-all duration-200"
      >
        <Server className="w-4 h-4 mr-2" />
        My Relays
        <ChevronDown className="w-4 h-4 ml-2" />
      </Button>

      <MyRelaysModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}