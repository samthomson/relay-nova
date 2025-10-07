// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { ChevronDown, LogOut, UserIcon, UserPlus, Wallet } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
import { RelaySelector } from '@/components/RelaySelector';
import { WalletModal } from '@/components/WalletModal';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { genUserName } from '@/lib/genUserName';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();

  if (!currentUser) return null;

  const getDisplayName = (account: Account): string => {
    return account.metadata.name ?? genUserName(account.pubkey);
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className='flex items-center gap-3 p-2 rounded-full hover:bg-white/10 transition-all text-white'>
          <Avatar className='w-8 h-8'>
            <AvatarImage src={currentUser.metadata.picture} alt={getDisplayName(currentUser)} />
            <AvatarFallback>{getDisplayName(currentUser).charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{getDisplayName(currentUser)}</span>
          <ChevronDown className='w-4 h-4' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-40 p-1 animate-scale-in'>
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
        >
          <LogOut className='w-4 h-4' />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}