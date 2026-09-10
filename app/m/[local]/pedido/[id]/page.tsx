export default async function PaginaSeguimientoPedido({
  params,
}: {
  params: Promise<{ local: string; id: string }>;
}) {
  const { local, id } = await params;

  return (
    <div>
      <h1>Seguimiento de pedido</h1>
      <p>Local: {local}</p>
      <p>Pedido: {id}</p>
    </div>
  );
}
