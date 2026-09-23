"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-loading">
      <h1>Let’s try that again.</h1>
      <p>
        Your workspace could not load. Check that the database is initialized.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Reload workspace
      </button>
      <a href="/">Return to sign in</a>
    </main>
  );
}
