'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteNavegador } from './supabase/navegador';
import type { User } from '@supabase/supabase-js';

type RolUsuario = 'dueno' | 'mostrador' | 'cocina';

interface UsuarioLocal {
  localId: string;
  rol: RolUsuario;
}

interface AuthContextValue {
  user: User | null;
  usuarioLocal: UsuarioLocal | null;
  cargando: boolean;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [usuarioLocal, setUsuarioLocal] = useState<UsuarioLocal | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const supabase = crearClienteNavegador();

    // Obtener sesión inicial
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);

      if (user) {
        // Obtener el primer rol del usuario
        supabase
          .from('usuarios_local')
          .select('local_id, rol')
          .eq('user_id', user.id)
          .limit(1)
          .single()
          .then(({ data }) => {
            if (data) {
              setUsuarioLocal({
                localId: data.local_id,
                rol: data.rol as RolUsuario,
              });
            }
            setCargando(false);
          });
      } else {
        setCargando(false);
      }
    });

    // Escuchar cambios en la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setUsuarioLocal(null);
        router.push('/panel/entrar');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const cerrarSesion = async () => {
    const supabase = crearClienteNavegador();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, usuarioLocal, cargando, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
