import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rewards import compute_rewards
from prizeversity import PrizeversityClient
from db import (
    init_db, save_week_results, get_streak_history, get_max_week, reset_db,
    get_weeks_with_data, get_week_results, delete_week_data,
    save_week_meta, save_early_submissions, get_week_meta, get_early_submissions,
    save_pv_settings, get_pv_settings, delete_pv_settings,
    save_student_mappings, get_student_mappings, delete_student_mappings,
    save_reward_send_log, get_reward_send_log,
    register_user, verify_user_password, get_user_by_crn,
)

app = FastAPI(title="RewardKeeper API")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load allowed CRNs from config
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)
ALLOWED_CRNS = {entry["crn"]: entry for entry in CONFIG["allowed_crns"]}

init_db()

@app.post("/api/register")
async def register(
    crn: str = Form(...),
    password: str = Form(...),
    ta_name: str = Form(...),
    subject: str = Form(""),
    course: str = Form(""),
    title: str = Form(""),
    class_start_time: str = Form("02:30:00 PM"),
):
    crn = crn.strip()
    if not crn:
        raise HTTPException(status_code=400, detail="CRN is required")
    if not ta_name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    try:
        register_user(crn, password, ta_name.strip(), subject.strip(), course.strip(), title.strip(), class_start_time.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "status": "ok",
        "ta_name": crn,
        "display_name": ta_name.strip(),
        "course_info": f"{subject.strip()} {course.strip()} — {title.strip()}".strip(" —"),
        "class_start_time": class_start_time.strip() or "02:30:00 PM",
    }


@app.post("/api/login")
async def login(crn: str = Form(...), password: str = Form(...)):
    crn = crn.strip()
    # First check registered users in DB
    user = verify_user_password(crn, password)
    if user:
        course_info = f"{user['subject']} {user['course']} — {user['title']}".strip(" —")
        return {
            "status": "ok",
            "ta_name": crn,
            "display_name": user["ta_name"],
            "course_info": course_info,
            "class_start_time": user.get("class_start_time", "02:30:00 PM"),
        }
    # Fallback to config-based auth
    try:
        crn_num = int(crn)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid CRN or password")
    if crn_num in ALLOWED_CRNS:
        try:
            if int(password) == crn_num * 2:
                entry = ALLOWED_CRNS[crn_num]
                return {
                    "status": "ok",
                    "ta_name": crn,
                    "display_name": entry.get("ta_name", ""),
                    "course_info": f"{entry['subject']} {entry['course']} — {entry['title']}",
                    "class_start_time": entry.get("class_start_time", "02:30:00 PM"),
                }
        except ValueError:
            pass
    raise HTTPException(status_code=401, detail="Invalid CRN or password")


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

    # Get class start time from DB user first, then config fallback
    db_user = get_user_by_crn(ta_name)
    if db_user:
        class_start = db_user.get("class_start_time", "02:30:00 PM")
    else:
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


# --- Prizeversity Endpoints ---

class PvSettingsBody(BaseModel):
    ta_name: str
    classroom_id: str
    api_key: str = ""


class MappingEntry(BaseModel):
    rk_name: str
    pv_student_id: str
    pv_name: str


class SaveMappingsBody(BaseModel):
    ta_name: str
    mappings: list[MappingEntry]


class SyncStudentsBody(BaseModel):
    ta_name: str


class SendRewardsBody(BaseModel):
    ta_name: str
    week: int
    dry_run: bool = True


@app.post("/api/prizeversity/settings")
async def pv_save_settings(body: PvSettingsBody):
    """Save Prizeversity settings. Validates by calling get_classroom."""
    api_key = body.api_key.strip()
    classroom_id = body.classroom_id.strip()
    client = PrizeversityClient(classroom_id, api_key)
    try:
        classroom = await client.get_classroom()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect to Prizeversity: {e}")
    save_pv_settings(body.ta_name, api_key, classroom_id)
    return {"status": "ok", "classroom": classroom}


@app.get("/api/prizeversity/settings/{ta_name}")
async def pv_get_settings(ta_name: str):
    """Check if Prizeversity is configured. Never returns the api_key."""
    settings = get_pv_settings(ta_name)
    if not settings:
        return {"configured": False}
    return {
        "configured": True,
        "classroom_id": settings["classroom_id"],
        "has_api_key": bool(settings["api_key"]),
    }


@app.post("/api/prizeversity/sync-students")
async def pv_sync_students(body: SyncStudentsBody):
    """Fetch PV students and auto-match against RK student names."""
    settings = get_pv_settings(body.ta_name)
    if not settings:
        raise HTTPException(status_code=400, detail="Prizeversity not configured")

    client = PrizeversityClient(settings["classroom_id"], settings["api_key"])

    # Get all unique RK student names from week_results
    max_week = get_max_week(body.ta_name)
    rk_names = set()
    for w in range(1, max_week + 1):
        for row in get_week_results(body.ta_name, w):
            rk_names.add(row["student_name"])
    rk_names = sorted(rk_names)

    # Fetch PV student list (for dropdown in unmatched cases)
    pv_students = []
    try:
        pv_result = await client.list_students()
        pv_students = pv_result.get("users", pv_result.get("students", []))
        # Normalize: ensure each student has a "studentId" field
        for s in pv_students:
            if "studentId" not in s and "userId" in s:
                s["studentId"] = s["userId"]
    except Exception:
        pass

    # Try PV's /users/match API first, fall back to local fuzzy matching
    matched = []
    unmatched = []
    try:
        match_result = await client.match_students_api(rk_names)
        # Response: { matched: [{name, externalId, studentId, ...}], unmatched: [{name, externalId, reason}] }
        for entry in match_result.get("matched", []):
            matched.append({
                "rk_name": entry.get("externalId", entry.get("name", "")),
                "pv_student_id": entry.get("studentId", entry.get("_id", "")),
                "pv_name": entry.get("name", ""),
                "score": 1.0,
            })
        for entry in match_result.get("unmatched", []):
            unmatched.append(entry.get("externalId", entry.get("name", "")))
    except Exception:
        # Fallback: use local fuzzy matching against the student list
        if pv_students:
            matched, unmatched = client.match_students_local(pv_students, rk_names)
        else:
            # Still return RK names as unmatched so the UI can show them
            unmatched = list(rk_names)

    # Also return existing saved mappings so the frontend can merge
    saved = get_student_mappings(body.ta_name)

    return {
        "pv_students": pv_students,
        "matched": matched,
        "unmatched": unmatched,
        "saved_mappings": saved,
    }


@app.post("/api/prizeversity/save-mappings")
async def pv_save_mappings(body: SaveMappingsBody):
    """Save manual student mappings."""
    mappings = [m.model_dump() for m in body.mappings]
    save_student_mappings(body.ta_name, mappings)
    return {"status": "ok", "count": len(mappings)}


@app.get("/api/prizeversity/mappings/{ta_name}")
async def pv_get_mappings(ta_name: str):
    """Get saved student mappings."""
    mappings = get_student_mappings(ta_name)
    return {"mappings": mappings}


@app.post("/api/prizeversity/send-rewards")
async def pv_send_rewards(body: SendRewardsBody):
    """DRY RUN: Aggregate points per student, resolve mappings, return preview.
    Does NOT call wallet/adjust."""
    settings = get_pv_settings(body.ta_name)
    if not settings:
        raise HTTPException(status_code=400, detail="Prizeversity not configured")

    # Get week results and meta
    week_results = get_week_results(body.ta_name, body.week)
    if not week_results:
        raise HTTPException(status_code=400, detail=f"No data for week {body.week}")

    meta = get_week_meta(body.ta_name, body.week)
    reward_points = meta["reward_points"] if meta else 0

    # Get early submissions
    early = get_early_submissions(body.ta_name, body.week)
    early_names = {e["student_name"] for e in early}

    # Get streak data
    streak_history = get_streak_history(body.ta_name, body.week)
    MIN_STREAK_WEEKS = 4

    # Aggregate points per student
    student_points = {}
    for r in week_results:
        name = r["student_name"]
        pts = 0
        reasons = []

        # Both full mark reward
        if r["both_perfect"]:
            pts += reward_points
            reasons.append(f"Both Full Mark: {reward_points}")

        # Early submission reward
        if name in early_names:
            pts += reward_points
            reasons.append(f"Early Submission: {reward_points}")

        # Streak reward
        if body.week >= MIN_STREAK_WEEKS:
            for s in streak_history:
                if s["name"] == name and s["streak_length"] >= MIN_STREAK_WEEKS:
                    streak_pts = reward_points * s["streak_length"]
                    pts += streak_pts
                    reasons.append(f"Streak ({s['streak_length']} weeks): {streak_pts}")
                    break

        if pts > 0:
            student_points[name] = {"points": pts, "reasons": reasons}

    # Resolve mappings
    mappings = get_student_mappings(body.ta_name)
    mapping_lookup = {m["rk_name"]: m for m in mappings}

    preview = []
    unmapped = []
    total_bits = 0

    for name, info in sorted(student_points.items()):
        mapping = mapping_lookup.get(name)
        if mapping:
            preview.append({
                "rk_name": name,
                "pv_name": mapping["pv_name"],
                "pv_student_id": mapping["pv_student_id"],
                "points": info["points"],
                "reasons": info["reasons"],
            })
            total_bits += info["points"]
        else:
            unmapped.append({
                "rk_name": name,
                "points": info["points"],
                "reasons": info["reasons"],
            })

    # If dry_run, just return preview; if not, actually send bits
    if body.dry_run:
        save_reward_send_log(
            body.ta_name, body.week, datetime.now().isoformat(),
            len(preview), total_bits,
            f"Week {body.week} rewards (preview)",
            status="preview",
        )
        return {
            "dry_run": True,
            "week": body.week,
            "reward_points": reward_points,
            "preview": preview,
            "unmapped": unmapped,
            "total_students": len(preview),
            "total_bits": total_bits,
        }

    # LIVE MODE: actually call wallet/adjust
    if not preview:
        raise HTTPException(status_code=400, detail="No mapped students to send rewards to")

    client = PrizeversityClient(settings["classroom_id"], settings["api_key"])
    updates = [{"userId": p["pv_student_id"], "amount": p["points"]} for p in preview]
    description = f"RewardKeeper Week {body.week} rewards"

    try:
        api_result = await client.adjust_wallet(updates, description)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to send rewards: {e}")

    save_reward_send_log(
        body.ta_name, body.week, datetime.now().isoformat(),
        len(preview), total_bits,
        description,
        status="sent",
    )

    return {
        "dry_run": False,
        "week": body.week,
        "reward_points": reward_points,
        "preview": preview,
        "unmapped": unmapped,
        "total_students": len(preview),
        "total_bits": total_bits,
        "api_result": api_result,
    }


@app.get("/api/prizeversity/send-status/{ta_name}/{week}")
async def pv_send_status(ta_name: str, week: int):
    """Check if rewards were 'sent' for a week."""
    log = get_reward_send_log(ta_name, week)
    if not log:
        return {"sent": False}
    return {
        "sent": True,
        "status": log["status"],
        "sent_at": log["sent_at"],
        "total_students": log["total_students"],
        "total_bits": log["total_bits"],
    }
