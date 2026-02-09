import json
import os

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from rewards import compute_rewards
from db import (
    init_db, save_week_results, get_streak_history, get_max_week, reset_db,
    get_weeks_with_data, get_week_results, delete_week_data,
    save_week_meta, save_early_submissions, get_week_meta, get_early_submissions,
)

app = FastAPI(title="RewardKeeper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load allowed CRNs from config
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)
ALLOWED_CRNS = {entry["crn"]: entry for entry in CONFIG["allowed_crns"]}

init_db()

@app.post("/api/login")
async def login(crn: str = Form(...), password: str = Form(...)):
    try:
        crn_num = int(crn)
    except ValueError:
        raise HTTPException(status_code=401, detail="CRN must be a number")
    if crn_num not in ALLOWED_CRNS:
        raise HTTPException(status_code=401, detail="CRN not authorized")
    if int(password) != crn_num * 2:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    entry = ALLOWED_CRNS[crn_num]
    return {
        "status": "ok",
        "ta_name": crn,
        "display_name": entry.get("ta_name", ""),
        "course_info": f"{entry['subject']} {entry['course']} — {entry['title']}",
        "class_start_time": entry.get("class_start_time", "02:30:00 PM"),
    }


@app.get("/api/streak/{ta_name}")
async def streak(ta_name: str):
    max_week = get_max_week(ta_name)
    if max_week == 0:
        return {"has_data": False}

    history = get_streak_history(ta_name, max_week)

    MIN_STREAK_WEEKS = 4
    rewarded = []
    if max_week >= MIN_STREAK_WEEKS:
        for s in history:
            if s["streak_length"] >= MIN_STREAK_WEEKS:
                rewarded.append({
                    "name": s["name"],
                    "streak_length": s["streak_length"],
                })

    return {
        "has_data": True,
        "max_week": max_week,
        "streak": {
            "min_weeks": MIN_STREAK_WEEKS,
            "history": history,
            "rewarded": rewarded,
            "total_rewarded": len(rewarded),
        },
    }


@app.post("/api/compute")
async def compute(
    problem1: UploadFile = File(...),
    problem2: UploadFile = File(...),
    week: int = Form(...),
    ta_name: str = Form(...),
    rewards_json: str = Form(""),
):
    if week < 1:
        raise HTTPException(status_code=400, detail="Week must be at least 1")

    custom_rewards = None
    if rewards_json:
        try:
            custom_rewards = json.loads(rewards_json)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid rewards JSON")

    try:
        file1_content = (await problem1.read()).decode("utf-8")
        file2_content = (await problem2.read()).decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Files must be valid UTF-8 CSV files")

    # Get class start time from config for this CRN
    crn_num = int(ta_name) if ta_name.isdigit() else 0
    class_start = ALLOWED_CRNS.get(crn_num, {}).get("class_start_time", "02:30:00 PM")

    try:
        result = compute_rewards(file1_content, file2_content, week, custom_rewards, class_start)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV files: {e}")

    # Save results to SQLite
    save_week_results(ta_name, week, result["students_data"])
    save_week_meta(ta_name, week, result["week_range"], result["reward_points"],
                   result["early_submission"]["total_eligible"])
    save_early_submissions(ta_name, week, result["early_submission"]["top5"])

    # Build full streak history (includes current week just saved)
    streak_history = get_streak_history(ta_name, week)

    # Streak rewards start at week 4
    MIN_STREAK_WEEKS = 4
    rewarded = []
    if week >= MIN_STREAK_WEEKS:
        for s in streak_history:
            if s["streak_length"] >= MIN_STREAK_WEEKS:
                rewarded.append({
                    "name": s["name"],
                    "streak_length": s["streak_length"],
                    "reward": result["reward_points"] * s["streak_length"],
                })

    # Remove internal students_data from response
    del result["students_data"]

    result["streak"] = {
        "min_weeks": MIN_STREAK_WEEKS,
        "history": streak_history,
        "rewarded": rewarded,
        "total_rewarded": len(rewarded),
    }

    return result


@app.get("/api/weeks/{ta_name}")
async def weeks_with_data(ta_name: str):
    """Return which weeks have stored data for this TA."""
    weeks = get_weeks_with_data(ta_name)
    return {"weeks": weeks}


@app.get("/api/week-data/{ta_name}/{week}")
async def week_data(ta_name: str, week: int):
    """Return stored results for a specific week."""
    rows = get_week_results(ta_name, week)
    if not rows:
        return {"has_data": False}

    full_mark = rows[0]["full_mark"] if rows else 0
    passed = [r["student_name"] for r in rows if r["both_perfect"]]
    not_passed = [
        {
            "name": r["student_name"],
            "problem1": f"{r['problem1_grade']}/{full_mark}",
            "problem2": f"{r['problem2_grade']}/{full_mark}",
        }
        for r in rows if not r["both_perfect"]
    ]

    meta = get_week_meta(ta_name, week)
    early = get_early_submissions(ta_name, week)
    top5 = [
        {
            "rank": e["rank"],
            "name": e["student_name"],
            "problems": e["problem"],
            "submission_time": e["submission_time"],
            "time_taken": e.get("time_taken", 0),
        }
        for e in early
    ]

    result = {
        "has_data": True,
        "dungeon_week": week,
        "full_mark": full_mark,
        "both_completion": {
            "passed": passed,
            "not_passed": not_passed,
            "total_passed": len(passed),
            "total_not_passed": len(not_passed),
        },
    }

    if meta:
        result["week_range"] = meta["week_range"]
        result["reward_points"] = meta["reward_points"]
        result["early_submission"] = {
            "top5": top5,
            "total_eligible": meta["total_eligible"],
        }

    return result


@app.post("/api/delete-week")
async def delete_week(ta_name: str = Form(...), week: int = Form(...)):
    """Delete data for a single week."""
    delete_week_data(ta_name, week)
    return {"status": "ok", "message": f"Week {week} data for {ta_name} has been deleted."}


@app.post("/api/reset")
async def reset(ta_name: str = Form(...)):
    reset_db(ta_name)
    return {"status": "ok", "message": f"All saved week data for {ta_name} has been cleared."}
