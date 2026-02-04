import { useState, useEffect } from "react";
import Login from "./components/Login.jsx";
import Rubric from "./components/Rubric.jsx";
import UploadForm from "./components/UploadForm.jsx";
import ResultsTable from "./components/ResultsTable.jsx";
import Summary from "./components/Summary.jsx";
import StreakTable from "./components/StreakTable.jsx";

const API_URL = "http://localhost:8000/api/compute";
const RESET_URL = "http://localhost:8000/api/reset";
const STREAK_URL = "http://localhost:8000/api/streak";

export default function App() {
  const [taName, setTaName] = useState(() => localStorage.getItem("taName"));
  const [showLogin, setShowLogin] = useState(false);
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [week, setWeek] = useState(1);
  const [results, setResults] = useState(null);
  const [streakData, setStreakData] = useState(null);
  const [streakWeek, setStreakWeek] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStreak = async (name) => {
    try {
      const res = await fetch(`${STREAK_URL}/${name}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.has_data) {
        setStreakData(data.streak);
        setStreakWeek(data.max_week);
      } else {
        setStreakData(null);
        setStreakWeek(0);
      }
    } catch {
      // silently ignore
    }
  };

  // On mount, if already logged in, fetch streak
  useEffect(() => {
    if (taName) fetchStreak(taName);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("taName");
    setTaName(null);
    setResults(null);
    setStreakData(null);
    setStreakWeek(0);
    setError(null);
  };

  const handleLogin = (name) => {
    localStorage.setItem("taName", name);
    setTaName(name);
    setShowLogin(false);
    setError(null);
    fetchStreak(name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!taName) {
      setShowLogin(true);
      return;
    }
    if (!file1 || !file2) {
      setError("Please select both CSV files.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append("problem1", file1);
    formData.append("problem2", file2);
    formData.append("week", week);
    formData.append("ta_name", taName);

    try {
      const res = await fetch(API_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      setResults(data);
      if (data.streak) {
        setStreakData(data.streak);
        setStreakWeek(data.dungeon_week);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!taName) {
      setShowLogin(true);
      return;
    }
    if (!confirm("This will clear all saved week data for your section. Are you sure?")) return;
    try {
      const formData = new FormData();
      formData.append("ta_name", taName);
      const res = await fetch(RESET_URL, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to reset");
      setResults(null);
      setStreakData(null);
      setStreakWeek(0);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const fm = results ? results.full_mark : 0;
  const completionHeaders = ["#", "Student", "Problem 1", "Problem 2", "Reward"];
  const completionRows = results
    ? results.both_completion.passed.map((name, i) => [
        i + 1,
        name,
        `${fm}/${fm}`,
        `${fm}/${fm}`,
        `${results.reward_points} pts`,
      ])
    : [];

  const earlyHeaders = ["Rank", "Student", "Full Mark On", "Submission Time", "Reward"];
  const earlyRows = results
    ? results.early_submission.top5.map((s) => [
        s.rank,
        s.name,
        s.problems,
        s.submission_time,
        `${results.reward_points} pts`,
      ])
    : [];

  return (
    <>
      <header className="app-header">
        <div className="header-content">
          <div className="header-top">
            <p className="header-subtitle">Debug Dungeon Reward Calculator</p>
            <h1 className="logo"><span className="logo-icon">🏆</span> RewardKeeper <span className="logo-icon">🎮</span></h1>
            <div className="header-user">
              {taName ? (
                <>
                  <span className="ta-badge">{taName}</span>
                  <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <button className="logout-btn" onClick={() => setShowLogin(true)}>Login</button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        {showLogin && !taName && (
          <Login onLogin={handleLogin} onCancel={() => setShowLogin(false)} />
        )}

        <Rubric />

        <UploadForm
          file1={file1}
          file2={file2}
          week={week}
          loading={loading}
          onFile1Change={setFile1}
          onFile2Change={setFile2}
          onWeekChange={setWeek}
          onSubmit={handleSubmit}
          onReset={handleReset}
        />

        {error && <div className="error">{error}</div>}

        {results && (
          <>
            <ResultsTable
              title={`Debug Dungeon Week ${results.dungeon_week} Both Full Mark Reward!`}
              subtitle={`Semester Week Range: ${results.week_range} → ${results.reward_points} points | Full Mark: ${results.full_mark}`}
              headers={completionHeaders}
              rows={completionRows}
            />

            <Summary
              totalPassed={results.both_completion.total_passed}
              totalNotPassed={results.both_completion.total_not_passed}
              notPassedDetails={results.both_completion.not_passed}
            />

            <ResultsTable
              title={`Debug Dungeon Week ${results.dungeon_week} Early Submission Reward!`}
              subtitle={`First 5 correct submissions → ${results.reward_points} points each`}
              headers={earlyHeaders}
              rows={earlyRows}
            />

            <p className="eligible-note">
              Total eligible students: {results.early_submission.total_eligible}
            </p>
          </>
        )}

        {streakData && (
          <StreakTable
            streakData={streakData}
            week={streakWeek}
          />
        )}
      </div>

      <footer className="app-footer">
        <p>Developed by Anik Tahabilder | Lab Instructor CSC1100</p>
        <p>&copy; {new Date().getFullYear()} RewardKeeper. All rights reserved.</p>
      </footer>
    </>
  );
}
