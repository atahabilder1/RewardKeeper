import { useState, useEffect } from "react";
import Login from "./components/Login.jsx";
import Rubric from "./components/Rubric.jsx";
import UploadForm from "./components/UploadForm.jsx";
import ResultsTable from "./components/ResultsTable.jsx";
import Summary from "./components/Summary.jsx";
import StreakTable from "./components/StreakTable.jsx";
import { downloadCSV } from "./utils/exportReport.js";

const API = "http://localhost:8000/api";

export default function App() {
  const [taName, setTaName] = useState(() => localStorage.getItem("taName"));
  const [courseInfo, setCourseInfo] = useState(() => localStorage.getItem("courseInfo") || "");
  const [displayName, setDisplayName] = useState(() => localStorage.getItem("displayName") || "");
  const [showLogin, setShowLogin] = useState(false);
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [week, setWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [rewardGroups, setRewardGroups] = useState([
    { start: 1, end: 4, reward: 10 },
    { start: 5, end: 8, reward: 20 },
    { start: 9, end: 12, reward: 30 },
  ]);
  const [results, setResults] = useState(null);
  const [streakData, setStreakData] = useState(null);
  const [streakWeek, setStreakWeek] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track which weeks already have data and the current week's saved data
  const [weeksWithData, setWeeksWithData] = useState([]);
  const [savedWeekData, setSavedWeekData] = useState(null);

  const weekHasData = weeksWithData.includes(week);

  // Fetch which weeks have stored data
  const fetchWeeksList = async (name) => {
    try {
      const res = await fetch(`${API}/weeks/${name}`);
      if (!res.ok) return;
      const data = await res.json();
      setWeeksWithData(data.weeks);
    } catch {
      // ignore
    }
  };

  // Fetch saved results for a specific week
  const fetchWeekData = async (name, w) => {
    try {
      const res = await fetch(`${API}/week-data/${name}/${w}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.has_data) {
        setSavedWeekData(data);
      } else {
        setSavedWeekData(null);
      }
    } catch {
      setSavedWeekData(null);
    }
  };

  const fetchStreak = async (name) => {
    try {
      const res = await fetch(`${API}/streak/${name}`);
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

  // On mount, if already logged in, fetch everything
  useEffect(() => {
    if (taName) {
      fetchStreak(taName);
      fetchWeeksList(taName);
    }
  }, []);

  // When week changes, fetch saved data for that week
  useEffect(() => {
    if (taName && weekHasData) {
      fetchWeekData(taName, week);
    } else {
      setSavedWeekData(null);
    }
    // Clear computed results when switching weeks
    setResults(null);
    setError(null);
  }, [week, weeksWithData]);

  const handleLogout = () => {
    localStorage.removeItem("taName");
    localStorage.removeItem("courseInfo");
    localStorage.removeItem("displayName");
    setTaName(null);
    setCourseInfo("");
    setDisplayName("");
    setResults(null);
    setStreakData(null);
    setStreakWeek(0);
    setWeeksWithData([]);
    setSavedWeekData(null);
    setError(null);
  };

  const handleLogin = (name, info, dName) => {
    localStorage.setItem("taName", name);
    localStorage.setItem("courseInfo", info || "");
    localStorage.setItem("displayName", dName || "");
    setTaName(name);
    setCourseInfo(info || "");
    setDisplayName(dName || "");
    setShowLogin(false);
    setError(null);
    fetchStreak(name);
    fetchWeeksList(name);
  };

  const handleWeekChange = (w) => {
    setWeek(w);
    setFile1(null);
    setFile2(null);
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
    formData.append("rewards_json", JSON.stringify(rewardGroups));

    try {
      const res = await fetch(`${API}/compute`, { method: "POST", body: formData });
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
      // Refresh weeks list since we just saved new data
      await fetchWeeksList(taName);
      await fetchWeekData(taName, week);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWeek = async () => {
    if (!taName) return;
    if (!confirm(`Delete data for Week ${week}? This cannot be undone.`)) return;
    try {
      const formData = new FormData();
      formData.append("ta_name", taName);
      formData.append("week", week);
      const res = await fetch(`${API}/delete-week`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to delete week data");
      setResults(null);
      setSavedWeekData(null);
      setError(null);
      await fetchWeeksList(taName);
      await fetchStreak(taName);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetAll = async () => {
    if (!taName) {
      setShowLogin(true);
      return;
    }
    if (!confirm("This will clear ALL saved week data for your section. Are you sure?")) return;
    try {
      const formData = new FormData();
      formData.append("ta_name", taName);
      const res = await fetch(`${API}/reset`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to reset");
      setResults(null);
      setStreakData(null);
      setStreakWeek(0);
      setWeeksWithData([]);
      setSavedWeekData(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Build display data from either fresh results or saved week data
  const displayData = results || savedWeekData;
  const fm = displayData ? displayData.full_mark : 0;
  const rewardPts = displayData ? displayData.reward_points : null;

  const completionHeaders = ["#", "Student", "Problem 1", "Problem 2", ...(rewardPts ? ["Reward"] : [])];
  const completionRows = displayData
    ? displayData.both_completion.passed.map((name, i) => [
        i + 1,
        name,
        `${fm}/${fm}`,
        `${fm}/${fm}`,
        ...(rewardPts ? [`${rewardPts} pts`] : []),
      ])
    : [];

  const hasEarly = displayData && displayData.early_submission;
  const earlyHeaders = ["Rank", "Student", "Earliest Full Mark", "Submission Time", "Time Taken", ...(rewardPts ? ["Reward"] : [])];
  const earlyRows = hasEarly
    ? displayData.early_submission.top5.map((s) => [
        s.rank,
        s.name,
        s.problems,
        s.submission_time,
        `${s.time_taken} min`,
        ...(rewardPts ? [`${rewardPts} pts`] : []),
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
                  <div className="header-user-top">
                    {displayName && <span className="ta-name">{displayName}</span>}
                    <span className="ta-badge">CRN: {taName}</span>
                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                  </div>
                  {courseInfo && <span className="course-info">{courseInfo}</span>}
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

        <Rubric rewardGroups={rewardGroups} onGroupsChange={setRewardGroups} totalWeeks={totalWeeks} />

        <UploadForm
          file1={file1}
          file2={file2}
          week={week}
          totalWeeks={totalWeeks}
          loading={loading}
          weekHasData={weekHasData}
          weeksWithData={weeksWithData}
          onFile1Change={setFile1}
          onFile2Change={setFile2}
          onWeekChange={handleWeekChange}
          onTotalWeeksChange={(newTotal) => {
            setTotalWeeks(newTotal);
            setRewardGroups((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              updated[updated.length - 1] = { ...last, end: Math.max(last.start, newTotal) };
              return updated;
            });
          }}
          onSubmit={handleSubmit}
          onDeleteWeek={handleDeleteWeek}
          onResetAll={handleResetAll}
        />

        {error && <div className="error">{error}</div>}

        {displayData && (
          <>
            <ResultsTable
              title={`Debug Dungeon Week ${displayData.dungeon_week} Both Full Mark${rewardPts ? " Reward!" : ""}`}
              subtitle={
                rewardPts && displayData.week_range
                  ? `Semester Week Range: ${displayData.week_range} → ${rewardPts} points | Full Mark: ${fm}`
                  : `Full Mark: ${fm}`
              }
              headers={completionHeaders}
              rows={completionRows}
            />

            <Summary
              totalPassed={displayData.both_completion.total_passed}
              totalNotPassed={displayData.both_completion.total_not_passed}
              notPassedDetails={displayData.both_completion.not_passed}
            />

            {hasEarly && (
              <>
                <ResultsTable
                  title={`Debug Dungeon Week ${displayData.dungeon_week} Early Submission Reward!`}
                  subtitle={
                    rewardPts
                      ? `First 5 correct submissions → ${rewardPts} points each`
                      : "First 5 correct submissions"
                  }
                  headers={earlyHeaders}
                  rows={earlyRows}
                />

              </>
            )}

          </>
        )}

        {streakData && (
          <StreakTable
            streakData={streakData}
            week={streakWeek}
            totalWeeks={totalWeeks}
          />
        )}

        {displayData && displayData.reward_points && (
          <div className="download-buttons">
            <button
              className="download-btn csv-btn"
              onClick={() => downloadCSV(displayData, streakData, streakWeek, totalWeeks)}
            >
              Download CSV
            </button>
          </div>
        )}
      </div>

      <footer className="app-footer">
        <p>Developed by Anik Tahabilder | Lab Instructor CSC1100</p>
        <p>&copy; {new Date().getFullYear()} RewardKeeper. All rights reserved.</p>
      </footer>
    </>
  );
}
