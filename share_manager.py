"""
share_manager.py - Resume Version & QR Sharing Management for ResumeIQ
Handles version history persistence, unique secure share IDs, QR code generation,
privacy controls (Private vs Shareable), access revocation, and factual "What Changed" diffing.
"""

import os
import json
import uuid
import io
import base64
from datetime import datetime
from typing import Dict, Any, List, Optional
import qrcode
from PIL import Image


class ShareManager:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(base_dir, "data")
        
        self.data_dir = data_dir
        self.versions_file = os.path.join(self.data_dir, "versions.json")
        self.versions: List[Dict[str, Any]] = []
        self._load_versions()

    def _load_versions(self):
        """Load stored versions from JSON file, initializing defaults if missing."""
        if os.path.exists(self.versions_file):
            try:
                with open(self.versions_file, "r", encoding="utf-8") as f:
                    self.versions = json.load(f)
                    return
            except Exception as e:
                print(f"Error loading versions.json: {e}")
        
        # Initialize with baseline versions if file doesn't exist
        self.versions = self._build_default_versions()
        self._save_to_file()

    def _save_to_file(self):
        """Persist versions to JSON file."""
        os.makedirs(self.data_dir, exist_ok=True)
        with open(self.versions_file, "w", encoding="utf-8") as f:
            json.dump(self.versions, f, indent=2, ensure_ascii=False)

    def _build_default_versions(self) -> List[Dict[str, Any]]:
        """Pre-seeds Version 01 and Version 02 for immediate exploration."""
        now = datetime.now()
        v1_date = "2026-09-24 14:30"
        v2_date = "2026-09-28 18:20"

        return [
            {
                "id": "ver_01",
                "version_number": "Version 01",
                "version_code": "v01",
                "created_at": v1_date,
                "date_display": "September 24, 2026",
                "filename": "Alex_Rivera_Software_Resume_v1.pdf",
                "health_score": 68,
                "match_score": 72,
                "target_role": "Software Engineer (Full Stack)",
                "share_id": "iq_share_v01_demo",
                "share_status": "Shareable",
                "allow_contact_info": False,
                "candidate_name": "Alex Rivera",
                "candidate_title": "Software Developer",
                "contact": {
                    "name": "Alex Rivera",
                    "email": "alex.rivera@email.com",
                    "phone": "(555) 234-5678",
                    "linkedin": "https://linkedin.com/in/alexrivera-dev",
                    "github": "https://github.com/alexrivera-dev"
                },
                "matched_skills": ["Python", "JavaScript", "SQL", "Git", "HTML5", "CSS3"],
                "missing_skills": ["Docker", "AWS", "PostgreSQL", "REST API", "CI/CD"],
                "skill_gaps": ["Docker", "AWS", "REST API"],
                "key_recommendations": [
                    "Restructure bullet points with Action Verb + Scope + Metric",
                    "Add tangible project evidence for backend database queries",
                    "Integrate modern containerization (Docker) and REST API principles"
                ],
                "measurable_bullets_count": 0,
                "skills_count": 9,
                "project_bullets_count": 2,
                "experience_bullets_count": 4,
                "changes_summary": "Initial baseline resume upload."
            },
            {
                "id": "ver_02",
                "version_number": "Version 02",
                "version_code": "v02",
                "created_at": v2_date,
                "date_display": "September 28, 2026",
                "filename": "Alex_Rivera_Optimized_SWE_v2.pdf",
                "health_score": 87,
                "match_score": 82,
                "target_role": "Software Engineer (Full Stack)",
                "share_id": "iq_share_v02_live",
                "share_status": "Shareable",
                "allow_contact_info": False,
                "candidate_name": "Alex Rivera",
                "candidate_title": "Full Stack Software Engineer",
                "contact": {
                    "name": "Alex Rivera",
                    "email": "alex.rivera@email.com",
                    "phone": "(555) 234-5678",
                    "linkedin": "https://linkedin.com/in/alexrivera-dev",
                    "github": "https://github.com/alexrivera-dev"
                },
                "matched_skills": ["Python", "JavaScript", "React", "PostgreSQL", "REST API", "Git", "Docker", "Redis"],
                "missing_skills": ["AWS", "Kubernetes", "TypeScript", "CI/CD"],
                "skill_gaps": ["AWS", "TypeScript"],
                "key_recommendations": [
                    "Strengthen AWS cloud deployment evidence in project descriptions",
                    "Add TypeScript code coverage metrics to client-side apps",
                    "Maintain high performance metrics for database indexing"
                ],
                "measurable_bullets_count": 4,
                "skills_count": 26,
                "project_bullets_count": 5,
                "experience_bullets_count": 7,
                "changes_summary": "Added Docker, React, and Redis evidence with 4 quantifiable outcome metrics."
            }
        ]

    def get_all_versions(self) -> List[Dict[str, Any]]:
        """Returns all versions ordered newest first."""
        return list(reversed(self.versions))

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        """Finds a version by its internal version ID."""
        for v in self.versions:
            if v["id"] == version_id or v.get("version_code") == version_id:
                return v
        return None

    def get_version_by_share_id(self, share_id: str) -> Optional[Dict[str, Any]]:
        """
        Finds a version by its public secure share ID.
        Returns None if not found or if the version has been revoked / set to Private.
        """
        if not share_id:
            return None
        for v in self.versions:
            if v.get("share_id") == share_id:
                if v.get("share_status") == "Shareable":
                    return v
                else:
                    return {"revoked": True, "version_number": v.get("version_number", "Version")}
        return None

    def save_or_create_version(
        self,
        parsed_resume: Dict[str, Any],
        skills_info: Dict[str, Any],
        health_data: Dict[str, Any],
        match_data: Optional[Dict[str, Any]] = None,
        skill_gap_data: Optional[Dict[str, Any]] = None,
        target_role: str = "Software Engineer",
        filename: str = "Resume.pdf",
        pdf_report_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates and stores a new resume analysis version.
        Automatically assigns next version number (e.g. Version 03).
        """
        next_index = len(self.versions) + 1
        ver_number_str = f"Version {next_index:02d}"
        ver_code_str = f"v{next_index:02d}"
        ver_id = f"ver_{uuid.uuid4().hex[:8]}"
        share_id = f"iq_{uuid.uuid4().hex[:12]}"
        now = datetime.now()

        # Extract skills
        detected_skills = skills_info.get("skill_names", [])
        health_score = health_data.get("overall_health", 75)
        match_score = match_data.get("overall_match", 78) if match_data else 80

        # Matched and missing skills
        matched_skills = [s["name"] for s in match_data.get("matched_skills", [])] if match_data else detected_skills[:8]
        missing_skills = [s["name"] for s in match_data.get("missing_skills", [])] if match_data else []
        skill_gaps = [s["name"] for s in skill_gap_data.get("critical", [])] if skill_gap_data else missing_skills[:3]
        if not skill_gaps and missing_skills:
            skill_gaps = missing_skills[:2]

        # Key recommendations
        key_recs = []
        if match_data and match_data.get("gaps"):
            key_recs.extend(match_data["gaps"][:2])
        if health_data.get("measurable_bullets_count", 0) < 3:
            key_recs.append("Add measurable business impact (percentages, latency, or throughput) to your project bullets")
        if not key_recs:
            key_recs = [
                "Strengthen technical evidence for core competencies",
                "Ensure live repository and demo links are listed on all major projects",
                "Keep tech stack keywords updated against target job descriptions"
            ]

        # Factual summary of changes if previous version exists
        changes_summary = f"Analyzed {len(detected_skills)} skills with health score {health_score}/100."
        if self.versions:
            prev = self.versions[-1]
            score_diff = health_score - prev.get("health_score", health_score)
            skills_diff = len(detected_skills) - prev.get("skills_count", len(detected_skills))
            sign_s = f"+{score_diff}" if score_diff > 0 else str(score_diff)
            sign_k = f"+{skills_diff}" if skills_diff > 0 else str(skills_diff)
            changes_summary = f"Score delta: {sign_s} pts. Skill footprint change: {sign_k} skills."

        contact = parsed_resume.get("contact", {})

        new_version = {
            "id": ver_id,
            "version_number": ver_number_str,
            "version_code": ver_code_str,
            "created_at": now.strftime("%Y-%m-%d %H:%M"),
            "date_display": now.strftime("%B %d, %Y"),
            "filename": filename,
            "health_score": health_score,
            "match_score": match_score,
            "target_role": target_role,
            "share_id": share_id,
            "share_status": "Shareable",
            "allow_contact_info": False,
            "candidate_name": contact.get("name", "Candidate"),
            "candidate_title": target_role,
            "contact": {
                "name": contact.get("name", "Candidate"),
                "email": contact.get("email", ""),
                "phone": contact.get("phone", ""),
                "linkedin": contact.get("linkedin", ""),
                "github": contact.get("github", "")
            },
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "skill_gaps": skill_gaps,
            "key_recommendations": key_recs[:3],
            "measurable_bullets_count": health_data.get("measurable_bullets_count", 0),
            "skills_count": len(detected_skills),
            "project_bullets_count": len(parsed_resume.get("project_bullets", [])),
            "experience_bullets_count": len(parsed_resume.get("experience_bullets", [])),
            "pdf_report_url": pdf_report_url or "",
            "changes_summary": changes_summary
        }

        self.versions.append(new_version)
        self._save_to_file()
        return new_version

    def generate_qr_data_url(self, target_url: str) -> str:
        """
        Generates a clean, crisp PNG QR code encoded as a data URL:
        data:image/png;base64,...
        Uses professional slate dark fill on pure white background.
        """
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2
        )
        qr.add_data(target_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_str}"

    def generate_qr_png_bytes(self, target_url: str) -> bytes:
        """Returns raw PNG bytes for downloading QR image."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2
        )
        qr.add_data(target_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def regenerate_share_qr(self, version_id: str) -> Optional[Dict[str, Any]]:
        """
        Invalidates existing share ID and issues a brand new secure share ID.
        Ensures any previously shared links or QR codes are completely revoked.
        """
        version = self.get_version(version_id)
        if not version:
            return None

        new_share_id = f"iq_{uuid.uuid4().hex[:12]}"
        version["share_id"] = new_share_id
        version["share_status"] = "Shareable"
        self._save_to_file()
        return version

    def set_privacy(self, version_id: str, share_status: str, allow_contact: Optional[bool] = None) -> Optional[Dict[str, Any]]:
        """Updates sharing permissions: 'Private' vs 'Shareable'."""
        version = self.get_version(version_id)
        if not version:
            return None

        if share_status in ["Private", "Shareable"]:
            version["share_status"] = share_status
        if allow_contact is not None:
            version["allow_contact_info"] = bool(allow_contact)

        self._save_to_file()
        return version

    def revoke_access(self, version_id: str) -> Optional[Dict[str, Any]]:
        """Revokes public access for a version immediately."""
        version = self.get_version(version_id)
        if not version:
            return None

        version["share_status"] = "Private"
        self._save_to_file()
        return version

    def compare_two_versions(self, old_ver: Dict[str, Any], new_ver: Dict[str, Any]) -> Dict[str, Any]:
        """
        Computes strict, fact-based 'What Changed?' differences between two versions.
        Does not invent improvements; strictly detects factual changes.
        """
        score_old = old_ver.get("health_score", 0)
        score_new = new_ver.get("health_score", 0)
        score_delta = score_new - score_old

        match_old = old_ver.get("match_score", 0)
        match_new = new_ver.get("match_score", 0)
        match_delta = match_new - match_old

        skills_old = set(old_ver.get("matched_skills", []))
        skills_new = set(new_ver.get("matched_skills", []))

        # Strictly detected newly added skills
        newly_detected_skills = list(skills_new - skills_old)
        
        # Project & Measurable improvements
        meas_old = old_ver.get("measurable_bullets_count", 0)
        meas_new = new_ver.get("measurable_bullets_count", 0)
        meas_delta = meas_new - meas_old

        proj_old = old_ver.get("project_bullets_count", 0)
        proj_new = new_ver.get("project_bullets_count", 0)
        proj_delta = proj_new - proj_old

        what_improved = []
        if newly_detected_skills:
            what_improved.append(f"New skills detected: {', '.join(newly_detected_skills[:5])}")
        if meas_delta > 0:
            what_improved.append(f"Added {meas_delta} measurable achievement bullet(s) with quantifiable outcomes")
        if proj_delta > 0:
            what_improved.append(f"Added {proj_delta} expanded project description(s) with technical depth")
        if score_delta > 0:
            what_improved.append(f"Overall resume health improved by +{score_delta} points")
        if match_delta > 0:
            what_improved.append(f"Job match alignment improved by +{match_delta}%")

        if not what_improved:
            what_improved.append("Maintained consistent core skills footprint across revisions.")

        # Still missing skills from target requirements
        still_missing = new_ver.get("missing_skills", [])
        if not still_missing:
            still_missing = new_ver.get("skill_gaps", [])

        return {
            "version_old": old_ver.get("version_number", "Old Version"),
            "version_new": new_ver.get("version_number", "New Version"),
            "score_old": score_old,
            "score_new": score_new,
            "score_delta_formatted": f"+{score_delta} points" if score_delta > 0 else f"{score_delta} points",
            "score_delta_raw": score_delta,
            "match_old": match_old,
            "match_new": match_new,
            "match_delta_formatted": f"+{match_delta}%" if match_delta > 0 else f"{match_delta}%",
            "what_improved": what_improved,
            "newly_detected_skills": newly_detected_skills,
            "still_missing": still_missing[:5]
        }
