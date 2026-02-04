export default function ResultsTable({ title, subtitle, headers, rows }) {
  if (rows.length === 0) return null;

  return (
    <div className="card results-table">
      {title && <h2>{title}</h2>}
      {subtitle && <p className="table-subtitle">{subtitle}</p>}
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
