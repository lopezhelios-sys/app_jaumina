'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteNavegador } from '@/lib/supabase/navegador';

export default function PaginaEntrar() {
  const router = useRouter();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError(null);

    try {
      const supabase = crearClienteNavegador();

      // Autenticar con Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: correo,
        password: clave,
      });

      if (authError || !authData.user) {
        setError('Correo o contraseña incorrectos');
        return;
      }

      // Obtener roles del usuario
      const { data: roles, error: rolesError } = await supabase
        .from('usuarios_local')
        .select('local_id, rol')
        .eq('user_id', authData.user.id);

      if (rolesError || !roles || roles.length === 0) {
        setError('No tenés permisos para acceder al panel');
        await supabase.auth.signOut();
        return;
      }

      // Si tiene un solo rol, ir directo a su pantalla
      if (roles.length === 1) {
        const rol = roles[0].rol;
        switch (rol) {
          case 'cocina':
            router.push('/panel/cocina');
            break;
          case 'mostrador':
            router.push('/panel/mostrador');
            break;
          case 'dueno':
            router.push('/panel/duenio');
            break;
        }
      } else {
        // Si tiene múltiples roles, ir al primero (podríamos mejorar esto)
        router.push('/panel/mostrador');
      }
    } catch (err) {
      console.error('Error al entrar:', err);
      setError('Ocurrió un error. Intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-bold">Ja'umina Panel</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="correo" className="mb-1 block text-sm font-medium text-gray-700">
                Correo
              </label>
              <input
                id="correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="clave" className="mb-1 block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                id="clave"
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300"
            >
              {cargando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
