export default function FartherhoodPage() {
  return (
    <main className="embedded-app-shell">
      <iframe
        src="/apps/fartherhood/index.html"
        title="FarTHERHOOD"
        className="embedded-app-frame"
      />
    </main>
  );
}
