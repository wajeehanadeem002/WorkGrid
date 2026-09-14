export default function Loading() {
  return (
    <main
      id="main-content"
      className="page"
      aria-busy="true"
      aria-label="Loading"
    >
      <div
        className="skeleton"
        style={{ width: "36%", height: "2.5rem", marginBottom: "1.5rem" }}
      />
      <div className="metric-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="skeleton" style={{ height: "7rem" }} key={item} />
        ))}
      </div>
      <div className="skeleton" style={{ height: "22rem" }} />
    </main>
  );
}
