import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "rewards.db")


def _get_conn():
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = _get_conn()
    # Check if the old table exists without ta_name column — if so, drop and recreate
    cursor = conn.execute("PRAGMA table_info(week_results)")
    columns = [row[1] for row in cursor.fetchall()]
    if columns and "ta_name" not in columns:
        conn.execute("DROP TABLE week_results")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS week_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ta_name TEXT NOT NULL,
            week INTEGER NOT NULL,
            student_name TEXT NOT NULL,
            problem1_grade INTEGER NOT NULL,
            problem2_grade INTEGER NOT NULL,
            full_mark INTEGER NOT NULL,
            both_perfect INTEGER NOT NULL,
            UNIQUE(ta_name, week, student_name)
        )
        """
    )
    conn.commit()
    conn.close()


def save_week_results(ta_name, week, students_data):
    """Save week results for all students under a specific TA.

    students_data: list of dicts with keys:
        student_name, problem1_grade, problem2_grade, full_mark, both_perfect
    """
    conn = _get_conn()
    for s in students_data:
        conn.execute(
            """
            INSERT OR REPLACE INTO week_results
                (ta_name, week, student_name, problem1_grade, problem2_grade, full_mark, both_perfect)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ta_name,
                week,
                s["student_name"],
                s["problem1_grade"],
                s["problem2_grade"],
                s["full_mark"],
                1 if s["both_perfect"] else 0,
            ),
        )
    conn.commit()
    conn.close()


def get_streak_history(ta_name, up_to_week):
    """Return per-student, per-week both_perfect status from week 1 to up_to_week.

    Filters by ta_name so each TA sees only their own data.

    Returns a list of dicts:
        [{ name, weeks: {1: bool, 2: bool, ...}, can_streak: bool, streak_length: int }]
    Sorted by name. can_streak is True if all weeks from 1 to up_to_week are perfect.
    streak_length is the count of consecutive perfect weeks from week 1.
    """
    conn = _get_conn()
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        "SELECT week, student_name, both_perfect "
        "FROM week_results WHERE ta_name = ? AND week <= ? ORDER BY week",
        (ta_name, up_to_week),
    ).fetchall()
    conn.close()

    # Build per-student history
    history = {}
    for row in rows:
        name = row["student_name"]
        if name not in history:
            history[name] = {}
        history[name][row["week"]] = bool(row["both_perfect"])

    result = []
    for name in sorted(history.keys()):
        weeks_map = history[name]
        # streak_length = consecutive perfect weeks from week 1
        streak = 0
        for w in range(1, up_to_week + 1):
            if weeks_map.get(w, False):
                streak += 1
            else:
                break
        # can_streak = all computed weeks so far are perfect
        can_streak = streak == up_to_week
        result.append({
            "name": name,
            "weeks": {w: weeks_map.get(w, False) for w in range(1, up_to_week + 1)},
            "can_streak": can_streak,
            "streak_length": streak,
        })

    return result


def get_max_week(ta_name):
    """Return the highest week number stored for a TA, or 0 if none."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT MAX(week) FROM week_results WHERE ta_name = ?",
        (ta_name,),
    ).fetchone()
    conn.close()
    return row[0] if row[0] is not None else 0


def reset_db(ta_name):
    """Delete all saved week results for a specific TA."""
    conn = _get_conn()
    conn.execute("DELETE FROM week_results WHERE ta_name = ?", (ta_name,))
    conn.commit()
    conn.close()
