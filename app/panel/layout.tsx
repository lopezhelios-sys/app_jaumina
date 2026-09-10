export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header>Panel del Local</header>
      <main>{children}</main>
    </div>
  );
}
