const TOTAL_WEEKS = 14;

export default function StreakTable({ streakData, week }) {
  if (!streakData || streakData.history.length === 0) return null;

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
  const minWeeks = streakData.min_weeks;

  // Check last N weeks (up to 4) for streak coloring
  const getRowClass = (s) => {
    const lookback = Math.min(4, week);
    const startWeek = week - lookback + 1;
    for (let w = startWeek; w <= week; w++) {
      const val = s.weeks[w] ?? s.weeks[String(w)] ?? false;
      if (!val) return "streak-broken";
    }
    return "streak-alive";
  };

  return (
    <div className="card streak-section">
      <h2>Streak Tracker</h2>
      <p className="table-subtitle">
        Both problems must be full mark each week. Streak reward starts at week{" "}
        {minWeeks}.
      </p>

      <div className="streak-table-wrapper">
        <table className="streak-grid">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              {weeks.map((w) => (
                <th key={w} className={w <= week ? "" : "week-future"}>
                  W{w}
                </th>
              ))}
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {streakData.history.map((s, i) => {
              const rowClass = getRowClass(s);
              return (
                <tr key={i} className={rowClass}>
                  <td>{i + 1}</td>
                  <td>{s.name}</td>
                  {weeks.map((w) => {
                    if (w > week) return <td key={w} className="streak-cell">{"\u2014"}</td>;
                    const val = s.weeks[w] ?? s.weeks[String(w)] ?? false;
                    return (
                      <td key={w} className={`streak-cell ${val ? "cell-pass" : "cell-fail"}`}>
                        {val ? "\u2714" : "\u2718"}
                      </td>
                    );
                  })}
                  <td>{s.streak_length}w</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {streakData.total_rewarded > 0 && (
        <p className="streak-total">
          Students earning streak reward: {streakData.total_rewarded}
        </p>
      )}
    </div>
  );
}
