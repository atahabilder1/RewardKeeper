import csv
import io
from datetime import datetime

DEFAULT_GROUPS = [
    {"start": 1, "end": 4, "reward": 10},
    {"start": 5, "end": 8, "reward": 20},
    {"start": 9, "end": 12, "reward": 30},
]


def get_reward_for_week(week: int, groups: list[dict] | None = None) -> tuple[str, int]:
    """Return (week_range_label, reward_points) for the given week."""
    grps = groups if groups else DEFAULT_GROUPS
    for g in grps:
        if g["start"] <= week <= g["end"]:
            return f"{g['start']}-{g['end']}", g["reward"]
    # Fallback: use the last group if week exceeds all ranges
    last = grps[-1]
    return f"{last['start']}-{last['end']}", last["reward"]


def parse_gradesheet(file_content: str) -> tuple[dict, int]:
    students = {}
    max_grade = 0
    reader = csv.DictReader(io.StringIO(file_content))
    for row in reader:
        name = row["Student"]
        test_result = row["Test Result"]
        grade = int(row["Grade"])
        max_grade = max(max_grade, grade)
        submission_date = datetime.strptime(
            row["Submission Date"], "%m/%d/%Y, %I:%M:%S %p"
        )
        students[name] = {
            "id": row["#"],
            "name": name,
            "test_result": test_result,
            "grade": grade,
            "submission_date": submission_date,
        }
    return students, max_grade


def compute_rewards(file1_content: str, file2_content: str, week: int, custom_groups: list[dict] | None = None, class_start_time: str = "02:30:00 PM") -> dict:
    sub1, max_grade1 = parse_gradesheet(file1_content)
    sub2, max_grade2 = parse_gradesheet(file2_content)

    full_mark = max(max_grade1, max_grade2)

    week_range, reward_points = get_reward_for_week(week, custom_groups)

    all_students = set(sub1.keys()) | set(sub2.keys())

    # Reward 1: Both Full Mark
    both_passed = []
    not_passed = []

    for name in sorted(all_students):
        grade1 = sub1.get(name, {}).get("grade", 0)
        grade2 = sub2.get(name, {}).get("grade", 0)
        full1 = grade1 == full_mark
        full2 = grade2 == full_mark
        if full1 and full2:
            both_passed.append(name)
        else:
            s1 = f"{grade1}/{full_mark}" if name in sub1 else "N/A"
            s2 = f"{grade2}/{full_mark}" if name in sub2 else "N/A"
            not_passed.append({"name": name, "problem1": s1, "problem2": s2})

    # Reward 2: Early Submission (Top 5) - earliest full-mark submission
    correct_students = []
    for name in all_students:
        g1 = sub1.get(name, {}).get("grade", 0)
        g2 = sub2.get(name, {}).get("grade", 0)
        full1 = g1 == full_mark
        full2 = g2 == full_mark
        if full1 or full2:
            # Find which full-mark problem was submitted earliest
            candidates = []
            if full1 and name in sub1:
                candidates.append(("Problem 1", sub1[name]["submission_date"]))
            if full2 and name in sub2:
                candidates.append(("Problem 2", sub2[name]["submission_date"]))
            earliest_problem, earliest_date = min(candidates, key=lambda x: x[1])
            correct_students.append((name, earliest_date, earliest_problem))

    correct_students.sort(key=lambda x: x[1])

    # Parse class start time to calculate duration
    # class_start_time is like "02:30:00 PM"
    start_time = datetime.strptime(class_start_time, "%I:%M:%S %p")

    top5 = []
    for i, (name, date, problems) in enumerate(correct_students[:5], 1):
        # Build a start datetime on the same date as submission
        start_dt = date.replace(hour=start_time.hour, minute=start_time.minute, second=start_time.second)
        diff = date - start_dt
        minutes_taken = max(0, diff.total_seconds() / 60)
        top5.append({
            "rank": i,
            "name": name,
            "submission_time": date.strftime("%m/%d/%Y, %I:%M:%S %p"),
            "problems": problems,
            "time_taken": round(minutes_taken, 1),
        })

    return {
        "dungeon_week": week,
        "week_range": week_range,
        "reward_points": reward_points,
        "full_mark": full_mark,
        "both_completion": {
            "passed": both_passed,
            "not_passed": not_passed,
            "total_passed": len(both_passed),
            "total_not_passed": len(not_passed),
        },
        "early_submission": {
            "top5": top5,
            "total_eligible": len(correct_students),
        },
        "students_data": [
            {
                "student_name": name,
                "problem1_grade": sub1.get(name, {}).get("grade", 0),
                "problem2_grade": sub2.get(name, {}).get("grade", 0),
                "full_mark": full_mark,
                "both_perfect": name in both_passed,
            }
            for name in sorted(all_students)
        ],
    }
