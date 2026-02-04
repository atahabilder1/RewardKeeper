export default function UploadForm({
  file1,
  file2,
  week,
  loading,
  onFile1Change,
  onFile2Change,
  onWeekChange,
  onSubmit,
  onReset,
}) {
  return (
    <form className="card upload-form" onSubmit={onSubmit}>
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

      <div className="form-group">
        <label htmlFor="week">Dungeon Week</label>
        <select
          id="week"
          value={week}
          onChange={(e) => onWeekChange(Number(e.target.value))}
        >
          {Array.from({ length: 14 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      <div className="form-buttons">
        <button type="submit" disabled={loading}>
          {loading ? "Computing..." : "Compute Rewards"}
        </button>
        <button type="button" className="reset-btn" onClick={onReset}>
          Reset Streak Data
        </button>
      </div>
    </form>
  );
}
