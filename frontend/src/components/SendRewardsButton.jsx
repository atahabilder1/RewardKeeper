import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

export default function SendRewardsButton({ taName, week, hasData }) {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [sentStatus, setSentStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taName) return;
    setPreview(null);
    setSendResult(null);
    setError(null);
    checkConfig();
    checkSentStatus();
  }, [taName, week]);

  const checkConfig = async () => {
    try {
      const res = await fetch(`${API}/prizeversity/settings/${taName}`);
      const data = await res.json();
      setConfigured(data.configured);
    } catch {
      setConfigured(false);
    }
  };

  const checkSentStatus = async () => {
    if (!week) return;
    try {
      const res = await fetch(`${API}/prizeversity/send-status/${taName}/${week}`);
      const data = await res.json();
      if (data.sent && data.status === "sent") {
        setSentStatus(data);
      } else {
        setSentStatus(null);
      }
    } catch {
      setSentStatus(null);
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    setSendResult(null);

    try {
      const res = await fetch(`${API}/prizeversity/send-rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ta_name: taName, week, dry_run: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Failed to generate preview");
      }
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!confirm(`Send ${preview.total_bits} bits to ${preview.total_students} students on Prizeversity? This cannot be undone.`)) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`${API}/prizeversity/send-rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ta_name: taName, week, dry_run: false }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Failed to send rewards");
      }
      const data = await res.json();
      setSendResult(data);
      setSentStatus({ sent: true, status: "sent" });
      setPreview(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!taName || !hasData) return null;

  if (!configured) {
    return (
      <div className="pv-send-wrapper">
        <button className="download-btn pv-btn pv-btn-disabled" disabled title="Configure Prizeversity in Settings first">
          Update Score at Prizeversity
        </button>
        <span className="pv-hint">Configure Prizeversity in Settings first</span>
      </div>
    );
  }

  return (
    <div className="pv-send-wrapper">
      {/* Already sent for this week */}
      {sentStatus && !preview && !sendResult ? (
        <div className="pv-sent-status">
          <button className="download-btn pv-btn pv-btn-sent" disabled>
            Rewards Sent (Week {week})
          </button>
          <div className="pv-sent-details">
            Sent {sentStatus.total_bits} bits to {sentStatus.total_students} students
            {sentStatus.sent_at && <> on {new Date(sentStatus.sent_at).toLocaleString()}</>}
          </div>
        </div>
      ) : !preview && !sendResult ? (
        <button
          className="download-btn pv-btn"
          onClick={handlePreview}
          disabled={loading}
        >
          {loading ? "Generating Preview..." : "Update Score at Prizeversity"}
        </button>
      ) : null}

      {error && <div className="pv-send-error">{error}</div>}

      {/* Send success result */}
      {sendResult && (
        <div className="pv-preview pv-send-success">
          <h3>Rewards Sent Successfully! - Week {sendResult.week}</h3>
          <p className="pv-preview-summary">
            {sendResult.total_students} students | {sendResult.total_bits} bits sent
          </p>
          {sendResult.api_result && sendResult.api_result.details && (
            <div className="pv-preview-table-wrapper">
              <table className="pv-preview-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Base</th>
                    <th>Final (w/ multipliers)</th>
                  </tr>
                </thead>
                <tbody>
                  {sendResult.api_result.details.map((d) => (
                    <tr key={d.studentId}>
                      <td>{d.name}</td>
                      <td>{d.baseAmount}</td>
                      <td className="pv-pts">{d.finalAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pv-sent-note">
            Bits have been sent to Prizeversity wallets.
          </div>
        </div>
      )}

      {/* Preview (dry run) */}
      {preview && (
        <div className="pv-preview">
          <h3>Reward Preview - Week {preview.week}</h3>
          <p className="pv-preview-summary">
            {preview.total_students} students | {preview.total_bits} total bits | {preview.reward_points} pts/reward
          </p>

          {preview.preview.length > 0 && (
            <div className="pv-preview-table-wrapper">
              <table className="pv-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student (RK)</th>
                    <th>Student (PV)</th>
                    <th>Points</th>
                    <th>Reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={row.rk_name}>
                      <td>{i + 1}</td>
                      <td>{row.rk_name}</td>
                      <td>{row.pv_name}</td>
                      <td className="pv-pts">{row.points}</td>
                      <td className="pv-reasons">{row.reasons.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.unmapped.length > 0 && (
            <div className="pv-unmapped-warning">
              <strong>Unmapped Students ({preview.unmapped.length}):</strong>
              <ul>
                {preview.unmapped.map((u) => (
                  <li key={u.rk_name}>
                    {u.rk_name} ({u.points} pts) - {u.reasons.join(", ")}
                  </li>
                ))}
              </ul>
              <p className="pv-hint">Map these students in Settings &gt; Sync Students to include them.</p>
            </div>
          )}

          <div className="pv-preview-actions">
            <button
              className="pv-confirm-btn"
              onClick={handleConfirmSend}
              disabled={sending || preview.total_students === 0}
            >
              {sending ? "Sending..." : `Confirm & Send ${preview.total_bits} Bits`}
            </button>
            <button
              className="login-cancel"
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
