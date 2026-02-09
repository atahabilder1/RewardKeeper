import { useState } from "react";

const LOGIN_URL = "http://localhost:8000/api/login";

export default function Login({ onLogin, onCancel }) {
  const [crn, setCrn] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("crn", crn);
    formData.append("password", password);

    try {
      const res = await fetch(LOGIN_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Invalid credentials");
      }
      const data = await res.json();
      onLogin(data.ta_name, data.course_info, data.display_name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay" onClick={onCancel}>
      <div className="login-card" onClick={(e) => e.stopPropagation()}>
        <h2>Login Required</h2>
        <p>Enter your course CRN to continue.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="crn">Course CRN</label>
            <input
              id="crn"
              type="text"
              inputMode="numeric"
              value={crn}
              onChange={(e) => setCrn(e.target.value)}
              placeholder="e.g. 12345"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              inputMode="numeric"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <div className="login-buttons">
            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
            <button type="button" className="login-cancel" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
