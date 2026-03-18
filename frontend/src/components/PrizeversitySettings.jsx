import { useState, useEffect } from "react";
import StudentMapping from "./StudentMapping.jsx";

const API = import.meta.env.VITE_API_URL || "/api";

export default function PrizeversitySettings({ taName, onClose }) {
  const [classroomId, setClassroomId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  useEffect(() => {
    checkSettings();
  }, []);

  const checkSettings = async () => {
    try {
      const res = await fetch(`${API}/prizeversity/settings/${taName}`);
      const data = await res.json();
      if (data.configured) {
        setConfigured(true);
        setClassroomId(data.classroom_id);
        setSuccess("Prizeversity is configured.");
      }
    } catch {
      // ignore
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API}/prizeversity/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ta_name: taName,
          classroom_id: classroomId,
          api_key: apiKey,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Failed to save settings");
      }
      const data = await res.json();
      setConfigured(true);
      setSuccess(`Connected! Classroom: ${data.classroom?.name || classroomId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="login-overlay" onClick={onClose}>
        <div className="pv-settings-card" onClick={(e) => e.stopPropagation()}>
          <h2>Prizeversity Settings</h2>
          <p>Connect to Prizeversity to send rewards automatically.</p>

          <form onSubmit={handleSave} className="login-form">
            <div className="form-group">
              <label htmlFor="pv-classroom">Classroom ID</label>
              <input
                id="pv-classroom"
                type="text"
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                placeholder="e.g. 696166712daecebcbe86558c"
                required
              />
              <span className="pv-hint">Found in your Prizeversity URL: prizeversity.com/classroom/<strong>your-id-here</strong></span>
            </div>
            <div className="form-group">
              <label htmlFor="pv-apikey">API Key <span className="optional-label">(X-API-Key header)</span></label>
              <input
                id="pv-apikey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pvk_..."
                required
              />
              <span className="pv-hint">Provided by your course instructor (Prof. Hadi Nasser) from the Prizeversity Integrations settings page</span>
            </div>

            {error && <div className="login-error">{error}</div>}
            {success && <div className="pv-success">{success}</div>}

            <div className="login-buttons">
              <button type="submit" disabled={loading || !classroomId || !apiKey}>
                {loading ? "Testing..." : "Test & Save"}
              </button>
              {configured && (
                <button
                  type="button"
                  className="pv-sync-btn"
                  onClick={() => setShowMapping(true)}
                >
                  Sync Students
                </button>
              )}
              <button type="button" className="login-cancel" onClick={onClose}>
                Close
              </button>
            </div>
          </form>
        </div>
      </div>

      {showMapping && (
        <StudentMapping
          taName={taName}
          onClose={() => setShowMapping(false)}
        />
      )}
    </>
  );
}
