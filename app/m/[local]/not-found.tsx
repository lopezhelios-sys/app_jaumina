export default function NoEncontrado() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <h2 className="mt-4 text-2xl font-semibold">Local no encontrado</h2>
        <p className="mt-2 text-gray-600">
          El local que buscás no existe o no está disponible.
        </p>
      </div>
    </div>
  );
}
