'use client';

import { useEffect, useState } from 'react';
import { crearClienteNavegador } from '@/lib/supabase/navegador';

interface EstadoLocal {
  abierto: boolean;
  en_horario: boolean;
  abierto_manual: boolean;
  latido_min: number;
  conexion: 'ok' | 'inestable' | 'caido';
}

export function EstadoLocal({ localId }: { localId: string }) {
  const [estado, setEstado] = useState<EstadoLocal | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const supabase = crearClienteNavegador();

    async function obtenerEstado() {
      try {
        const { data, error } = await supabase.rpc('local_disponible', {
          p_local: localId,
        });

        if (!error && data) {
          setEstado(data as EstadoLocal);
        }
      } catch (error) {
        console.error('Error al obtener estado del local:', error);
      } finally {
        setCargando(false);
      }
    }

    obtenerEstado();

    // Refrescar cada 30 segundos para mantener el estado actualizado
    const intervalo = setInterval(obtenerEstado, 30000);

    return () => clearInterval(intervalo);
  }, [localId]);

  if (cargando) {
    return (
      <div className="border-b px-6 py-4">
        <p className="text-center text-sm text-gray-400">Verificando disponibilidad...</p>
      </div>
    );
  }

  if (!estado) {
    return null;
  }

  return (
    <div className="border-b px-6 py-4">
      {estado.abierto ? (
        <p className="text-center text-green-600">🟢 Abierto ahora</p>
      ) : (
        <p className="text-center text-gray-600">
          🔴 Cerrado
          {!estado.en_horario && ' (fuera de horario)'}
        </p>
      )}

      {estado.conexion === 'caido' && (
        <p className="mt-2 text-center text-sm text-amber-600">
          ⚠️ El local puede tener problemas de conexión
        </p>
      )}
      {estado.conexion === 'inestable' && (
        <p className="mt-2 text-center text-sm text-amber-500">Conexión inestable</p>
      )}
    </div>
  );
}
