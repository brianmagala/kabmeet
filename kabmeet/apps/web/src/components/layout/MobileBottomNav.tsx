'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Play, Radio, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Discover', icon: Radio },
  { href: '/communities', label: 'Clubs', icon: Users },
  { href: '/classes', label: 'Classes', icon: CalendarDays },
  { href: '/watch', label: 'Watch', icon: Play },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-amber-gold/35 bg-indaba-deep-green text-white md:hidden"
    >
      <div className="grid h-16 grid-cols-4 items-center">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 transition-colors duration-fast',
                isActive ? 'text-signal-green' : 'text-white/80 hover:text-white',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] whitespace-nowrap">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
