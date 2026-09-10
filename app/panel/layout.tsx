'use client';

import { AuthProvider } from '@/lib/auth-panel';
import { Latido } from '@/componentes/panel/Latido';

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Latido />
      {children}
    </AuthProvider>
  );
}
