export default async function PaginaRepartidor({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div>
      <h1>Vista del Repartidor</h1>
      <p>Token: {token}</p>
    </div>
  );
}
