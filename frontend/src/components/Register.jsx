import { useState } from "react";

const API = import.meta.env.VITE_API_URL || "/api";
const REGISTER_URL = `${API}/register`;

export default function Register({ onRegister, onCancel, onSwitchToLogin }) {
  const [crn, setCrn] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [taName, setTaName] = useState("");
  const [subject, setSubject] = useState("");
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [classStartTime, setClassStartTime] = useState("02:30:00 PM");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("crn", crn);
    formData.append("password", password);
    formData.append("ta_name", taName);
    formData.append("subject", subject);
    formData.append("course", course);
    formData.append("title", title);
    formData.append("class_start_time", classStartTime);

    try {
      const res = await fetch(REGISTER_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Registration failed");
      }
      const data = await res.json();
      onRegister(data.ta_name, data.course_info, data.display_name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay" onClick={onCancel}>
      <div className="login-card register-card" onClick={(e) => e.stopPropagation()}>
        <h2>Create Account</h2>
        <p>Register to start tracking rewards.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="reg-name">Your Name</label>
            <input
              id="reg-name"
              type="text"
              value={taName}
              onChange={(e) => setTaName(e.target.value)}
              placeholder="e.g. John Doe"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-crn">Course CRN</label>
            <input
              id="reg-crn"
              type="text"
              inputMode="numeric"
              value={crn}
              onChange={(e) => setCrn(e.target.value)}
              placeholder="e.g. 12345"
              required
            />
          </div>
          <div className="register-row">
            <div className="form-group">
              <label htmlFor="reg-subject">Subject</label>
              <input
                id="reg-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. CSC"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-course">Course #</label>
              <input
                id="reg-course"
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. 1100"
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="reg-title">Course Title</label>
            <input
              id="reg-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Problem Solving and Programming"
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-time">Class Start Time</label>
            <input
              id="reg-time"
              type="text"
              value={classStartTime}
              onChange={(e) => setClassStartTime(e.target.value)}
              placeholder="e.g. 02:30:00 PM"
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 4 characters"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <div className="login-buttons">
            <button type="submit" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
            <button type="button" className="login-cancel" onClick={onCancel}>
              Cancel
            </button>
          </div>
          <p className="auth-switch">
            Already have an account?{" "}
            <button type="button" className="auth-switch-btn" onClick={onSwitchToLogin}>
              Login
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
