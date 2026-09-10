'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-panel';
import { crearClienteNavegador } from '@/lib/supabase/navegador';

/**
 * Componente que actualiza local_estado.ultimo_latido cada 30 segundos.
 *
 * Esto hace honesto el aviso del menú público sobre el estado
 * de conexión del local.
 */
export function Latido() {
  const { usuarioLocal } = useAuth();

  useEffect(() => {
    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();

    const enviarLatido = async () => {
      await supabase
        .from('local_estado')
        .upsert(
          {
            local_id: usuarioLocal.localId,
            ultimo_latido: new Date().toISOString(),
          },
          {
            onConflict: 'local_id',
          }
        );
    };

    // Enviar latido inmediatamente
    enviarLatido();

    // Luego cada 30 segundos
    const intervalo = setInterval(enviarLatido, 30000);

    return () => {
      clearInterval(intervalo);
    };
  }, [usuarioLocal]);

  return null; // No renderiza nada
}
