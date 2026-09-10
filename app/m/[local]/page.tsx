export default async function PaginaMenuPublico({
  params,
}: {
  params: Promise<{ local: string }>;
}) {
  const { local } = await params;

  return (
    <div>
      <h1>Menú de {local}</h1>
      <p>Próximamente</p>
    </div>
  );
}
