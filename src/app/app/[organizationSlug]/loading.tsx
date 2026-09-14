export default function WorkspaceLoading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading workspace">
      <div
        className="skeleton"
        style={{ width: "34%", height: "2.4rem", marginBottom: "1.5rem" }}
      />
      <div className="metric-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="skeleton" style={{ height: "7rem" }} key={item} />
        ))}
      </div>
      <div className="skeleton" style={{ height: "22rem" }} />
    </div>
  );
}
