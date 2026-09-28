"""
matcher.py - The Match Engine & Explainability Analyzer
Computes multi-dimensional match scores (Technical Skills, Experience, Education, Projects, Keywords),
matched vs missing skills with actionable context, and explainable Strengths & Gaps.
"""

import re
from typing import Dict, Any, List


class MatchEngine:
    def __init__(self, skill_extractor):
        self.extractor = skill_extractor

    def match(self, parsed_resume: Dict[str, Any], resume_skills_info: Dict[str, Any], jd_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Computes granular matching between resume and job description.
        """
        detected_skills = resume_skills_info.get("all_detected_skills", {})
        candidate_skill_names = set(detected_skills.keys())

        required_skills = jd_info.get("required_skills", [])
        preferred_skills = jd_info.get("preferred_skills", [])
        all_jd_skills = jd_info.get("all_jd_skills", [])

        # If JD had no specific skills extracted, fallback to generic match
        if not all_jd_skills:
            all_jd_skills = ["Python", "SQL", "Git", "REST API"]
            required_skills = ["Python", "SQL", "Git"]
            preferred_skills = ["REST API"]

        # 1. Matched and Missing Skills
        matched_required = [s for s in required_skills if s in candidate_skill_names]
        missing_required = [s for s in required_skills if s not in candidate_skill_names]

        matched_preferred = [s for s in preferred_skills if s in candidate_skill_names]
        missing_preferred = [s for s in preferred_skills if s not in candidate_skill_names]

        matched_skills_list = []
        for s in matched_required + matched_preferred:
            info = detected_skills.get(s, {})
            matched_skills_list.append({
                "name": s,
                "importance": "Required" if s in required_skills else "Preferred",
                "evidence_level": info.get("evidence_level", "Basic"),
                "evidence_label": info.get("evidence_label", "Mentioned in resume"),
                "sample_evidence": info.get("sample_evidence", "")
            })

        missing_skills_list = []
        for s in missing_required + missing_preferred:
            advice = self.extractor.skill_advice.get(
                s,
                f"Frequently associated with {jd_info.get('role_title', 'this role')}. Consider developing a hands-on project or demonstrating related competencies."
            )
            missing_skills_list.append({
                "name": s,
                "importance": "Critical" if s in missing_required else "Important",
                "advice": advice,
                "learning_path": self.extractor.learning_paths.get(s, [])
            })

        # 2. Category Match Scoring
        # A) Technical Skills Score (Weight: 35%)
        # Weighted higher if candidate has concrete project/work evidence!
        req_score = 0
        if required_skills:
            req_weights = 0
            for s in required_skills:
                if s in candidate_skill_names:
                    ev_lvl = detected_skills[s].get("evidence_level", "Basic")
                    if ev_lvl == "High":
                        req_weights += 1.0
                    elif ev_lvl == "Medium":
                        req_weights += 0.85
                    else:
                        req_weights += 0.70
            req_score = (req_weights / len(required_skills)) * 100
        else:
            req_score = 80.0

        pref_score = 0
        if preferred_skills:
            pref_weights = sum(0.9 if s in candidate_skill_names else 0 for s in preferred_skills)
            pref_score = (pref_weights / len(preferred_skills)) * 100
        else:
            pref_score = 75.0

        tech_skills_score = round(min(100, (req_score * 0.75) + (pref_score * 0.25)))

        # B) Experience Score (Weight: 20%)
        # Calculate years of experience mentioned in resume
        raw_text = parsed_resume.get("raw_text", "")
        exp_years_found = 0
        exp_matches = re.findall(r'(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience', raw_text, re.IGNORECASE)
        if exp_matches:
            exp_years_found = max(int(m) for m in exp_matches)
        else:
            # Estimate from number of experience bullet points and year dates
            years_in_text = re.findall(r'\b(201\d|202\d)\b', raw_text)
            if years_in_text:
                unique_years = sorted(list(set(int(y) for y in years_in_text)))
                if len(unique_years) >= 2:
                    exp_years_found = max(1, unique_years[-1] - unique_years[0])
                else:
                    exp_years_found = 2
            else:
                exp_years_found = 1 if len(parsed_resume.get("experience_bullets", [])) > 2 else 0

        req_years = jd_info.get("experience_years_required", 2)
        if exp_years_found >= req_years:
            experience_score = 92
        elif exp_years_found >= req_years - 1:
            experience_score = 76
        elif exp_years_found > 0:
            experience_score = 62
        else:
            experience_score = 45

        # C) Education Score (Weight: 15%)
        education_section = parsed_resume.get("sections", {}).get("education", "").lower()
        if any(deg in education_section or deg in raw_text.lower() for deg in ["bachelor", "b.s", "bs ", "b.tech", "master", "m.s", "phd", "degree"]):
            education_score = 100
        elif len(education_section) > 15:
            education_score = 85
        else:
            education_score = 60

        # D) Projects Score (Weight: 15%)
        project_bullets = parsed_resume.get("project_bullets", [])
        proj_count = len(project_bullets)
        # Check if skills appear in project descriptions
        skills_in_projects = sum(1 for s in detected_skills.values() if s.get("project_instances", 0) > 0)

        if proj_count >= 4 and skills_in_projects >= 3:
            projects_score = 92
        elif proj_count >= 2 and skills_in_projects >= 2:
            projects_score = 84
        elif proj_count >= 1:
            projects_score = 70
        else:
            projects_score = 50

        # E) Keywords & Context Alignment (Weight: 15%)
        # Overlap of technical and domain vocabulary
        jd_words = set(re.findall(r'\b[a-zA-Z]{4,}\b', jd_info.get("role_title", "") + " " + " ".join(all_jd_skills)).copy())
        resume_words = set(re.findall(r'\b[a-zA-Z]{4,}\b', raw_text.lower()))
        matched_words = sum(1 for w in jd_words if w.lower() in resume_words)
        keywords_score = round(min(98, max(50, (matched_words / max(1, len(jd_words))) * 95)))

        # 3. Overall Weighted Score
        overall_match = round(
            (tech_skills_score * 0.35) +
            (experience_score * 0.20) +
            (education_score * 0.15) +
            (projects_score * 0.15) +
            (keywords_score * 0.15)
        )
        overall_match = max(35, min(98, overall_match))

        # 4. Explainability: Strengths & Gaps
        strengths = []
        gaps = []

        if len(matched_required) >= len(required_skills) * 0.7:
            strengths.append(f"Strong core requirements alignment: {len(matched_required)}/{len(required_skills)} required technical competencies detected.")
        
        high_evidence_skills = [s for s, d in detected_skills.items() if d.get("evidence_level") == "High" and s in all_jd_skills]
        if high_evidence_skills:
            strengths.append(f"Practical hands-on evidence: {', '.join(high_evidence_skills[:3])} demonstrated in work experience and projects.")

        if education_score >= 90:
            strengths.append("Educational background fully meets academic qualification prerequisites.")

        if experience_score >= 80:
            strengths.append(f"Experience duration ({exp_years_found}+ years) comfortably satisfies the role requirements ({req_years} years).")

        # Gaps
        if missing_required:
            gaps.append(f"Missing essential required skills: {', '.join(missing_required[:3])}.")
        
        if missing_preferred:
            gaps.append(f"Lacks preferred differentiators: {', '.join(missing_preferred[:3])}.")

        low_evidence_skills = [s for s in matched_required if detected_skills.get(s, {}).get("evidence_level") == "Basic"]
        if low_evidence_skills:
            gaps.append(f"Limited context for {', '.join(low_evidence_skills[:2])}: listed in skills section but lacking specific project bullet points.")

        if experience_score < 75:
            gaps.append(f"Experience timeframe ({exp_years_found} years) is below target role preference ({req_years}+ years).")

        return {
            "overall_match": overall_match,
            "category_scores": {
                "technical_skills": tech_skills_score,
                "experience": experience_score,
                "education": education_score,
                "projects": projects_score,
                "keywords": keywords_score
            },
            "category_table": [
                {"category": "Technical Skills", "score": tech_skills_score, "weight": "35%"},
                {"category": "Experience", "score": experience_score, "weight": "20%"},
                {"category": "Education", "score": education_score, "weight": "15%"},
                {"category": "Projects", "score": projects_score, "weight": "15%"},
                {"category": "Keywords & Context", "score": keywords_score, "weight": "15%"}
            ],
            "matched_skills": matched_skills_list,
            "missing_skills": missing_skills_list,
            "matched_count": len(matched_skills_list),
            "missing_count": len(missing_skills_list),
            "strengths": strengths if strengths else ["Good foundational presentation of core engineering skills."],
            "gaps": gaps if gaps else ["No major qualification deficits found against this job description."],
            "target_role": jd_info.get("role_title", "Target Role"),
            "experience_detected": exp_years_found,
            "experience_required": req_years
        }
