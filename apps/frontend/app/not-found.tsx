import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page-loading">
      <h1>This path is still uncharted.</h1>
      <p>The page you’re looking for isn’t here.</p>
      <Link className="btn btn-primary" href="/">
        Back to TalentOS
      </Link>
    </main>
  );
}
