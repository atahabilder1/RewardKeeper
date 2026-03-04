import httpx
from difflib import SequenceMatcher


BASE_URL = "https://www.prizeversity.com/api/integrations"


class PrizeversityClient:
    """Client for the Prizeversity Integration API.

    Auth: X-API-Key header (keys created by teachers from Integrations settings).

    In dry-run mode, only get_classroom, list_students, and match_students are used.
    adjust_wallet exists but is NOT called — the send-rewards endpoint
    returns a preview without actually sending bits.
    """

    def __init__(self, classroom_id, api_key=""):
        self.classroom_id = classroom_id
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": api_key,
        }

    async def get_classroom(self):
        """Validate credentials by fetching classroom info.
        GET /classroom/:classroomId → { _id, name, code, studentCount }
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{BASE_URL}/classroom/{self.classroom_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def list_students(self):
        """Get all students in the classroom.
        GET /users/list/CLASSROOM_ID
        → { classroomId, className, students: [{ studentId, name, email }] }
        """
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{BASE_URL}/users/list/{self.classroom_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def match_students_api(self, rk_names):
        """Use Prizeversity's /users/match to match RK names to PV MongoDB ObjectIds.
        POST /users/match
        Request: { classroomId, students: [{ name, externalId }] }
        """
        students = [{"name": name, "externalId": name} for name in rk_names]
        payload = {
            "classroomId": self.classroom_id,
            "students": students,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{BASE_URL}/users/match",
                json=payload,
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    def match_students_local(self, pv_students, rk_names):
        """Fallback: auto-match RK names to PV students using local fuzzy matching.

        Returns:
            matched: list of {rk_name, pv_student_id, pv_name, score}
            unmatched: list of rk_names that couldn't be matched
        """
        matched = []
        unmatched = []
        used_pv_ids = set()

        for rk_name in rk_names:
            best_score = 0
            best_pv = None
            rk_lower = rk_name.lower().strip()

            for pv in pv_students:
                pv_id = pv.get("studentId", pv.get("_id", ""))
                if pv_id in used_pv_ids:
                    continue
                pv_name = pv.get("name", "").lower().strip()
                score = SequenceMatcher(None, rk_lower, pv_name).ratio()

                # Also try matching with first/last name swapped
                parts = pv_name.split()
                if len(parts) == 2:
                    swapped = f"{parts[1]} {parts[0]}"
                    swap_score = SequenceMatcher(None, rk_lower, swapped).ratio()
                    score = max(score, swap_score)

                if score > best_score:
                    best_score = score
                    best_pv = pv

            if best_pv and best_score >= 0.75:
                pv_id = best_pv.get("studentId", best_pv.get("_id", ""))
                matched.append({
                    "rk_name": rk_name,
                    "pv_student_id": pv_id,
                    "pv_name": best_pv.get("name", ""),
                    "score": round(best_score, 2),
                })
                used_pv_ids.add(pv_id)
            else:
                unmatched.append(rk_name)

        return matched, unmatched

    async def adjust_wallet(self, updates, description):
        """Send bits to students. NOT called in dry-run mode.
        POST /wallet/adjust
        updates: list of {studentId, amount}
        """
        payload = {
            "classroomId": self.classroom_id,
            "updates": updates,
            "description": description,
            "applyGroupMultipliers": True,
            "applyPersonalMultipliers": True,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{BASE_URL}/wallet/adjust",
                json=payload,
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()
