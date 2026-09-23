export default function Loading() {
  return (
    <div className="page-loading" role="status">
      <div className="loading-logo">H</div>
      <p>Preparing your workspace…</p>
      <div className="skeleton-loader" />
    </div>
  );
}
