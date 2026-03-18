import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

export default function StudentMapping({ taName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [matched, setMatched] = useState([]);
  const [unmatched, setUnmatched] = useState([]);
  const [pvStudents, setPvStudents] = useState([]);
  const [manualMappings, setManualMappings] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    syncStudents();
  }, []);

  const syncStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/prizeversity/sync-students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ta_name: taName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Failed to sync students");
      }
      const data = await res.json();
      setPvStudents(data.pv_students || []);

      // Merge saved mappings with auto-matched
      const savedLookup = {};
      for (const m of data.saved_mappings || []) {
        savedLookup[m.rk_name] = m;
      }

      // For auto-matched, keep them; for saved, overlay
      const autoMatched = data.matched || [];
      const allMatched = [...autoMatched];
      const stillUnmatched = [];

      for (const name of data.unmatched || []) {
        if (savedLookup[name]) {
          allMatched.push({
            rk_name: name,
            pv_student_id: savedLookup[name].pv_student_id,
            pv_name: savedLookup[name].pv_name,
            score: 1.0,
          });
        } else {
          stillUnmatched.push(name);
        }
      }

      setMatched(allMatched);
      setUnmatched(stillUnmatched);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSelect = (rkName, pvStudentId) => {
    const pv = pvStudents.find((s) => s.studentId || s.userId || s._id === pvStudentId);
    setManualMappings((prev) => ({
      ...prev,
      [rkName]: pvStudentId
        ? { pv_student_id: pvStudentId, pv_name: pv?.name || "" }
        : undefined,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Combine auto-matched + manual into one list
      const allMappings = matched.map((m) => ({
        rk_name: m.rk_name,
        pv_student_id: m.pv_student_id,
        pv_name: m.pv_name,
      }));

      for (const [rkName, mapping] of Object.entries(manualMappings)) {
        if (mapping) {
          allMappings.push({
            rk_name: rkName,
            pv_student_id: mapping.pv_student_id,
            pv_name: mapping.pv_name,
          });
        }
      }

      const res = await fetch(`${API}/prizeversity/save-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ta_name: taName, mappings: allMappings }),
      });
      if (!res.ok) throw new Error("Failed to save mappings");
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // IDs already used by auto-match
  const usedPvIds = new Set(matched.map((m) => m.pv_student_id));
  // Also exclude manually selected ones
  for (const mapping of Object.values(manualMappings)) {
    if (mapping) usedPvIds.add(mapping.pv_student_id);
  }

  return (
    <div className="login-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="pv-mapping-card" onClick={(e) => e.stopPropagation()}>
        <h2>Student Mapping</h2>
        <p>Match RewardKeeper students to Prizeversity accounts.</p>

        {loading && <div className="pv-loading">Syncing students...</div>}
        {error && <div className="login-error">{error}</div>}
        {saved && <div className="pv-success">Mappings saved successfully!</div>}

        {!loading && (
          <>
            {matched.length > 0 && (
              <div className="pv-section">
                <h3>Auto-Matched ({matched.length})</h3>
                <div className="pv-match-list">
                  {matched.map((m) => (
                    <div key={m.rk_name} className="pv-match-row matched">
                      <span className="pv-check">&#10003;</span>
                      <span className="pv-rk-name">{m.rk_name}</span>
                      <span className="pv-arrow">&#8594;</span>
                      <span className="pv-pv-name">{m.pv_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unmatched.length > 0 && (
              <div className="pv-section">
                <h3>Unmatched ({unmatched.length})</h3>
                <div className="pv-match-list">
                  {unmatched.map((name) => (
                    <div key={name} className="pv-match-row unmatched">
                      <span className="pv-warn">!</span>
                      <span className="pv-rk-name">{name}</span>
                      <span className="pv-arrow">&#8594;</span>
                      <select
                        className="pv-select"
                        value={manualMappings[name]?.pv_student_id || ""}
                        onChange={(e) => handleManualSelect(name, e.target.value)}
                      >
                        <option value="">-- Select PV Student --</option>
                        {pvStudents
                          .filter(
                            (s) =>
                              !usedPvIds.has(s.studentId || s.userId || s._id) ||
                              manualMappings[name]?.pv_student_id === s.studentId || s.userId || s._id
                          )
                          .map((s) => (
                            <option key={s.studentId || s.userId || s._id} value={s.studentId || s.userId || s._id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matched.length === 0 && unmatched.length === 0 && (
              <div className="pv-loading">
                No students found. Compute at least one week first.
              </div>
            )}

            <div className="login-buttons" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || (matched.length === 0 && Object.keys(manualMappings).length === 0)}
                style={{ padding: "0.7rem 1.5rem", background: "#0d7377", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
              >
                {saving ? "Saving..." : "Save Mappings"}
              </button>
              <button type="button" className="login-cancel" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
