export default function Summary({ totalPassed, totalNotPassed, notPassedDetails }) {
  return (
    <div className="card summary">
      <div className="summary-stats">
        <div className="stat passed">
          <span className="stat-number">{totalPassed}</span>
          <span className="stat-label">Full Mark on Both</span>
        </div>
        <div className="stat not-passed">
          <span className="stat-number">{totalNotPassed}</span>
          <span className="stat-label">Did Not Get Full Mark on Both</span>
        </div>
      </div>

      {notPassedDetails.length > 0 && (
        <details className="failure-details">
          <summary>View students who did not get full mark on both</summary>
          <ul>
            {notPassedDetails.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong> — Problem 1: {s.problem1}, Problem 2:{" "}
                {s.problem2}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
