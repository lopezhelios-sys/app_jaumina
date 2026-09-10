'use client';

import { AuthProvider } from '@/lib/auth-panel';

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
