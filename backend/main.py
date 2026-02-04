from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from rewards import compute_rewards
from db import init_db, save_week_results, get_streak_history, get_max_week, reset_db

app = FastAPI(title="RewardKeeper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

USERS = {"anik": "anik", "urshi": "urshi", "aditi": "aditi", "test": "test"}


@app.post("/api/login")
async def login(username: str = Form(...), password: str = Form(...)):
    if USERS.get(username) != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"status": "ok", "ta_name": username}


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
):
    if not 1 <= week <= 14:
        raise HTTPException(status_code=400, detail="Week must be between 1 and 14")

    try:
        file1_content = (await problem1.read()).decode("utf-8")
        file2_content = (await problem2.read()).decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Files must be valid UTF-8 CSV files")

    try:
        result = compute_rewards(file1_content, file2_content, week)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV files: {e}")

    # Save results to SQLite
    save_week_results(ta_name, week, result["students_data"])

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


@app.post("/api/reset")
async def reset(ta_name: str = Form(...)):
    reset_db(ta_name)
    return {"status": "ok", "message": f"All saved week data for {ta_name} has been cleared."}
