export default function UploadForm({
  file1,
  file2,
  week,
  totalWeeks,
  loading,
  weekHasData,
  weeksWithData,
  onFile1Change,
  onFile2Change,
  onWeekChange,
  onTotalWeeksChange,
  onSubmit,
  onDeleteWeek,
  onResetAll,
}) {
  const handleAddWeek = () => {
    onTotalWeeksChange(totalWeeks + 1);
  };

  const handleRemoveWeek = () => {
    if (totalWeeks <= 1) return;
    const newTotal = totalWeeks - 1;
    onTotalWeeksChange(newTotal);
    if (week > newTotal) onWeekChange(newTotal);
  };

  return (
    <form className="card upload-form" onSubmit={onSubmit}>
      <div className="form-group">
        <label htmlFor="week">Dungeon Week</label>
        <select
          id="week"
          value={week}
          onChange={(e) => onWeekChange(Number(e.target.value))}
        >
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}{weeksWithData.includes(w) ? " (data exists)" : ""}
            </option>
          ))}
        </select>
      </div>

      {weekHasData ? (
        <div className="week-status">
          <p className="week-status-text">
            Week {week} already has data saved. The results are shown below.
          </p>
          <p className="week-status-hint">
            To re-upload, delete this week's data first.
          </p>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label htmlFor="problem1">Problem 1 CSV</label>
            <input
              id="problem1"
              type="file"
              accept=".csv"
              onChange={(e) => onFile1Change(e.target.files[0] || null)}
            />
            {file1 && <span className="file-name">{file1.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="problem2">Problem 2 CSV</label>
            <input
              id="problem2"
              type="file"
              accept=".csv"
              onChange={(e) => onFile2Change(e.target.files[0] || null)}
            />
            {file2 && <span className="file-name">{file2.name}</span>}
          </div>
        </>
      )}

      <div className="form-group">
        <label>Total Weeks</label>
        <div className="total-weeks-control">
          <button type="button" className="week-btn" onClick={handleRemoveWeek} disabled={totalWeeks <= 1}>-</button>
          <span className="total-weeks-value">{totalWeeks}</span>
          <button type="button" className="week-btn" onClick={handleAddWeek}>+</button>
        </div>
      </div>

      <div className="form-buttons">
        {!weekHasData && (
          <button type="submit" disabled={loading}>
            {loading ? "Computing..." : "Compute Rewards"}
          </button>
        )}
        {weekHasData && (
          <button type="button" className="delete-week-btn" onClick={onDeleteWeek}>
            Delete Week {week} Data
          </button>
        )}
        <button type="button" className="reset-btn" onClick={onResetAll}>
          Reset All Data
        </button>
      </div>
    </form>
  );
}
