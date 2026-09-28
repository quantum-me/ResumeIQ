"""
recommendations.py - Career Recommendations, Bullet Rewriter, Skill Gap Roadmap & Evolution
Provides intelligent role recommendations with explainability, interactive sentence rewriter,
skill gap pathways, and multi-version evolution tracking.
"""

import re
import json
import os
from typing import Dict, Any, List


class CareerAdvisor:
    def __init__(self, roles_path: str = None):
        if roles_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            roles_path = os.path.join(base_dir, "data", "job_roles.json")
        
        self.roles_path = roles_path
        self.standard_roles = []
        self._load_roles()

    def _load_roles(self):
        if os.path.exists(self.roles_path):
            with open(self.roles_path, "r", encoding="utf-8") as f:
                self.standard_roles = json.load(f)

    def recommend_roles(self, candidate_skills: List[str]) -> List[Dict[str, Any]]:
        """
        Calculates role alignment based on candidate skills and explains WHY.
        """
        skill_set = set(candidate_skills)
        recommendations = []

        for role in self.standard_roles:
            req = set(role.get("required_skills", []))
            pref = set(role.get("preferred_skills", []))
            all_skills = req.union(pref)

            matched_req = req.intersection(skill_set)
            matched_pref = pref.intersection(skill_set)
            matched_all = matched_req.union(matched_pref)

            if not all_skills:
                continue

            # Alignment percentage
            req_pct = (len(matched_req) / len(req)) if req else 0
            pref_pct = (len(matched_pref) / len(pref)) if pref else 0
            total_pct = round((req_pct * 0.7 + pref_pct * 0.3) * 100)

            # Rating category
            if total_pct >= 75:
                alignment = "High"
                badge_class = "badge-success"
            elif total_pct >= 55:
                alignment = "Moderate"
                badge_class = "badge-warning"
            else:
                alignment = "Developing"
                badge_class = "badge-neutral"

            # Explain WHY
            key_evidence = list(matched_req)
            if not key_evidence:
                key_evidence = list(matched_all)
            
            why_text = f"Your demonstrated proficiency in {', '.join(key_evidence[:4])} directly supports {role['title']} core competencies."
            if not key_evidence:
                why_text = f"Requires foundational ramp-up in {', '.join(list(req)[:3])}."

            recommendations.append({
                "role_id": role["id"],
                "role_title": role["title"],
                "company": role.get("company", "Industry Standard"),
                "level": role.get("level", "Mid-Level"),
                "alignment": alignment,
                "badge_class": badge_class,
                "alignment_score": total_pct,
                "matched_skills": list(matched_all),
                "missing_skills": list(req.difference(skill_set)),
                "why": why_text,
                "description": role.get("description", "")
            })

        # Sort by alignment score descending
        recommendations.sort(key=lambda x: x["alignment_score"], reverse=True)
        return recommendations

    def build_skill_gap_analysis(self, missing_skills_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Organizes missing skills into Critical, Important, and Optional,
        and constructs a step-by-step career development learning path.
        """
        critical = [s for s in missing_skills_list if s.get("importance") == "Critical"]
        important = [s for s in missing_skills_list if s.get("importance") == "Important"]
        optional = [s for s in missing_skills_list if s.get("importance") not in ["Critical", "Important"]]

        # Flatten learning path steps
        roadmap = []
        step_number = 1

        # Priority 1: Critical skills
        for s in critical[:2]:
            steps = s.get("learning_path", [])
            for item in steps[:2]:
                roadmap.append({
                    "step": step_number,
                    "skill": s["name"],
                    "phase": "Phase 1: Core Foundation",
                    "title": item.get("step", f"Learn {s['name']}"),
                    "desc": item.get("desc", s.get("advice", "")),
                    "time": item.get("time", "6-8 hours")
                })
                step_number += 1

        # Priority 2: Important skills
        for s in important[:2]:
            steps = s.get("learning_path", [])
            if steps:
                item = steps[0]
                roadmap.append({
                    "step": step_number,
                    "skill": s["name"],
                    "phase": "Phase 2: Project Application",
                    "title": item.get("step", f"Implement {s['name']}"),
                    "desc": item.get("desc", s.get("advice", "")),
                    "time": item.get("time", "5-7 hours")
                })
                step_number += 1

        return {
            "critical": critical,
            "important": important,
            "optional": optional,
            "roadmap": roadmap,
            "total_gaps": len(critical) + len(important) + len(optional)
        }

    def improve_sentence(self, original_bullet: str) -> Dict[str, Any]:
        """
        Resume Improvement Assistant:
        Rewrites a weak bullet point into the proven formula:
        Action Verb + Technology + Problem / Scope + Quantifiable Result
        Provides 3 distinct professional tones: Metric-Focused, Technical Architecture, Leadership.
        """
        clean = original_bullet.strip()
        # Extract any technologies mentioned
        tech_matches = re.findall(r'\b(Python|JavaScript|React|Node\.js|Django|Flask|SQL|PostgreSQL|AWS|Docker|Git|Kubernetes|REST API|Redis)\b', clean, re.IGNORECASE)
        tech_str = ", ".join(list(set(tech_matches))) if tech_matches else "relevant technologies"

        # Variations
        metric_focused = (
            f"Architected and optimized scalable services using {tech_str}, "
            f"reducing system latency by 38% and supporting 150K+ daily transactions with 99.9% availability."
        )
        technical_arch = (
            f"Engineered robust end-to-end service pipelines leveraging {tech_str}, "
            f"implementing automated error handling and caching to decrease API failure rates by 45%."
        )
        leadership_tone = (
            f"Spearheaded cross-functional delivery of core feature modules utilizing {tech_str}, "
            f"accelerating release cycles by 25% across a sprint team of 6 engineers."
        )

        return {
            "original": clean,
            "formula": "Action Verb + Technology + Problem/Scope + Quantifiable Result",
            "variations": [
                {
                    "label": "Metric & Impact Focused (Recommended)",
                    "text": metric_focused,
                    "action_verb": "Architected & optimized",
                    "metric_highlight": "38% latency reduction, 150K+ daily txns"
                },
                {
                    "label": "Technical Architecture",
                    "text": technical_arch,
                    "action_verb": "Engineered",
                    "metric_highlight": "45% reduction in failure rates"
                },
                {
                    "label": "Engineering Leadership & Delivery",
                    "text": leadership_tone,
                    "action_verb": "Spearheaded",
                    "metric_highlight": "25% acceleration in release cycle"
                }
            ]
        }

    def compare_resume_versions(self, v1_data: Dict[str, Any], v2_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compares Resume v1 and Resume v2 to illustrate resume evolution.
        Shows delta score, added skills, and improvements.
        """
        score1 = v1_data.get("health_score", 65)
        score2 = v2_data.get("health_score", 85)
        delta_score = score2 - score1

        skills1 = set(v1_data.get("skills", []))
        skills2 = set(v2_data.get("skills", []))
        added_skills = list(skills2 - skills1)
        retained_skills = list(skills1.intersection(skills2))

        bullets_v1 = v1_data.get("measurable_bullets", 0)
        bullets_v2 = v2_data.get("measurable_bullets", 4)
        metric_delta = bullets_v2 - bullets_v1

        improvements = []
        if delta_score > 0:
            improvements.append(f"+{delta_score} point increase in overall ATS & health score")
        if added_skills:
            improvements.append(f"Added {len(added_skills)} verified modern tech skills: {', '.join(added_skills[:4])}")
        if metric_delta > 0:
            improvements.append(f"Added {metric_delta} quantifiable impact metrics with percentages and data points")
        if v2_data.get("risks_count", 0) < v1_data.get("risks_count", 3):
            resolved = v1_data.get("risks_count", 3) - v2_data.get("risks_count", 0)
            improvements.append(f"Resolved {resolved} resume risk item(s)")

        return {
            "version_old": v1_data.get("version", "v1"),
            "version_new": v2_data.get("version", "v2"),
            "score_old": score1,
            "score_new": score2,
            "delta_score": f"+{delta_score}" if delta_score > 0 else str(delta_score),
            "added_skills": added_skills,
            "retained_skills": retained_skills,
            "improvements": improvements
        }
