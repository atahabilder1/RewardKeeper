import csv
import io
from datetime import datetime

WEEK_REWARDS = {"1-4": 10, "5-8": 20, "9-14": 30}


def get_week_range(week: int) -> str:
    if 1 <= week <= 4:
        return "1-4"
    elif 5 <= week <= 8:
        return "5-8"
    elif 9 <= week <= 14:
        return "9-14"
    raise ValueError(f"Week must be between 1 and 14, got {week}")


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


def compute_rewards(file1_content: str, file2_content: str, week: int) -> dict:
    sub1, max_grade1 = parse_gradesheet(file1_content)
    sub2, max_grade2 = parse_gradesheet(file2_content)

    full_mark = max(max_grade1, max_grade2)

    week_range = get_week_range(week)
    reward_points = WEEK_REWARDS[week_range]

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

    # Reward 2: Early Submission (Top 5) - any full mark in either problem
    correct_students = []
    for name in all_students:
        g1 = sub1.get(name, {}).get("grade", 0)
        g2 = sub2.get(name, {}).get("grade", 0)
        full1 = g1 == full_mark
        full2 = g2 == full_mark
        if full1 or full2:
            problems = []
            if full1:
                problems.append("Problem 1")
            if full2:
                problems.append("Problem 2")
            dates = []
            if name in sub1:
                dates.append(sub1[name]["submission_date"])
            if name in sub2:
                dates.append(sub2[name]["submission_date"])
            earliest = min(dates)
            correct_students.append((name, earliest, ", ".join(problems)))

    correct_students.sort(key=lambda x: x[1])

    top5 = [
        {
            "rank": i,
            "name": name,
            "submission_time": date.strftime("%m/%d/%Y, %I:%M:%S %p"),
            "problems": problems,
        }
        for i, (name, date, problems) in enumerate(correct_students[:5], 1)
    ]

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
