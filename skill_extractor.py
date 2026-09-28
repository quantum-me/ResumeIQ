"""
skill_extractor.py - Advanced Intelligence and Evidence-Based Skill Detection
Extracts skills from text, identifies categories, domains, and finds textual evidence in Projects and Experience.
"""

import json
import os
import re
from typing import Dict, Any, List, Set


class SkillExtractor:
    def __init__(self, db_path: str = None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(base_dir, "data", "skills_database.json")
        
        self.db_path = db_path
        self.categories = {}
        self.skill_advice = {}
        self.learning_paths = {}
        self.all_skills = []
        self._load_database()

    def _load_database(self):
        if os.path.exists(self.db_path):
            with open(self.db_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.categories = data.get("categories", {})
                self.skill_advice = data.get("skill_advice", {})
                self.learning_paths = data.get("learning_paths", {})
        
        # Build flattened lookup list
        self.skill_lookup = []
        for cat_name, skill_list in self.categories.items():
            for item in skill_list:
                name = item["name"]
                aliases = item.get("aliases", [])
                domain = item.get("domain", "General")
                
                # Build regex patterns
                patterns = []
                for term in [name] + aliases:
                    # Escape special regex chars except spaces
                    escaped = re.escape(term)
                    # For terms ending or starting with +, #, etc., handle word boundaries safely
                    if term in ["C++", "c++"]:
                        p = r'(?:(?<=\s)|(?<=^)|(?<=[(\[,]))c\+\+(?:(?=\s)|(?=$)|(?=[),.;\]]))'
                    elif term in ["C#", "c#"]:
                        p = r'(?:(?<=\s)|(?<=^)|(?<=[(\[,]))c#(?:(?=\s)|(?=$)|(?=[),.;\]]))'
                    elif term in [".NET", ".net"]:
                        p = r'(?:(?<=\s)|(?<=^))\.net(?:(?=\s)|(?=$)|(?=[),.;\]]))'
                    elif term in ["Go", "go", "GO"]:
                        p = r'\b(?:golang|go)\b'
                    elif term in ["R", "r"]:
                        p = r'(?:(?<=\s)|(?<=^)|(?<=[(\[,]))[Rr](?:(?=\s)|(?=$)|(?=[),.;\]]))'
                    else:
                        p = r'\b' + escaped + r'\b'
                    patterns.append(p)

                combined_regex = re.compile("|".join(patterns), re.IGNORECASE)
                self.skill_lookup.append({
                    "name": name,
                    "category": cat_name,
                    "domain": domain,
                    "regex": combined_regex
                })

    def extract_skills_with_evidence(self, parsed_resume: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes resume structure and gathers concrete evidence for each skill:
        - Skills section presence
        - Project presence (with specific sentences)
        - Experience presence (with specific sentences)
        - Confidence rating: High (Project + Experience), Medium (Project or Experience), Basic (List only)
        """
        sections = parsed_resume.get("sections", {})
        summary_text = sections.get("summary", "")
        skills_text = sections.get("skills", "")
        experience_text = sections.get("experience", "")
        projects_text = sections.get("projects", "")
        full_text = parsed_resume.get("raw_text", "")

        detected_skills = {}
        domains_counter = {}

        # Split experience and projects into sentences/bullet points for pinpoint evidence
        exp_sentences = [s.strip() for s in re.split(r'[\n\r•\-\*]+', experience_text) if len(s.strip()) > 10]
        proj_sentences = [s.strip() for s in re.split(r'[\n\r•\-\*]+', projects_text) if len(s.strip()) > 10]

        for item in self.skill_lookup:
            skill_name = item["name"]
            regex = item["regex"]

            in_skills_section = bool(regex.search(skills_text))
            in_summary = bool(regex.search(summary_text))
            
            # Find evidence in experience
            exp_evidence = []
            for sent in exp_sentences:
                if regex.search(sent):
                    exp_evidence.append(sent)

            # Find evidence in projects
            proj_evidence = []
            for sent in proj_sentences:
                if regex.search(sent):
                    proj_evidence.append(sent)

            # Total occurrences across full text
            all_matches = regex.findall(full_text)
            count = len(all_matches)

            if count > 0 or in_skills_section or exp_evidence or proj_evidence:
                # Evidence level determination
                if exp_evidence and proj_evidence:
                    evidence_level = "High"
                    evidence_label = "Verified in Work Experience & Projects"
                elif exp_evidence:
                    evidence_level = "High"
                    evidence_label = f"Verified in Work Experience ({len(exp_evidence)} instances)"
                elif proj_evidence:
                    evidence_level = "Medium"
                    evidence_label = f"Demonstrated in Projects ({len(proj_evidence)} instances)"
                elif in_skills_section:
                    evidence_level = "Basic"
                    evidence_label = "Listed in Skills Section"
                else:
                    evidence_level = "Low"
                    evidence_label = "Mentioned in resume context"

                # Pick top snippet
                sample_evidence = ""
                if exp_evidence:
                    sample_evidence = exp_evidence[0]
                elif proj_evidence:
                    sample_evidence = proj_evidence[0]
                elif in_skills_section:
                    sample_evidence = "Referenced in Technical Skills inventory"
                elif in_summary:
                    sample_evidence = "Referenced in Professional Summary"

                detected_skills[skill_name] = {
                    "name": skill_name,
                    "category": item["category"],
                    "domain": item["domain"],
                    "count": count,
                    "evidence_level": evidence_level,
                    "evidence_label": evidence_label,
                    "sample_evidence": sample_evidence,
                    "in_skills_section": in_skills_section,
                    "experience_instances": len(exp_evidence),
                    "project_instances": len(proj_evidence),
                    "experience_snippets": exp_evidence[:2],
                    "project_snippets": proj_evidence[:2]
                }

                dom = item["domain"]
                domains_counter[dom] = domains_counter.get(dom, 0) + 1

        # Categorize detected skills
        by_category = {}
        for skill_info in detected_skills.values():
            cat = skill_info["category"]
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(skill_info)

        # Sort top domains
        top_domains = sorted(domains_counter.items(), key=lambda x: x[1], reverse=True)

        return {
            "all_detected_skills": detected_skills,
            "skills_by_category": by_category,
            "skill_names": list(detected_skills.keys()),
            "total_skills_count": len(detected_skills),
            "evidence_breakdown": {
                "high": sum(1 for s in detected_skills.values() if s["evidence_level"] == "High"),
                "medium": sum(1 for s in detected_skills.values() if s["evidence_level"] == "Medium"),
                "basic_or_low": sum(1 for s in detected_skills.values() if s["evidence_level"] in ["Basic", "Low"])
            },
            "top_domains": top_domains
        }

    def extract_from_job_description(self, jd_text: str) -> Dict[str, Any]:
        """
        Parses a Job Description to identify required skills, preferred skills,
        experience requirements, education, and role classification.
        """
        detected_in_jd = []
        for item in self.skill_lookup:
            if item["regex"].search(jd_text):
                detected_in_jd.append(item["name"])

        # Distinguish between required vs preferred
        required_skills = []
        preferred_skills = []

        lines = jd_text.split("\n")
        in_preferred_section = False
        in_required_section = False

        for line in lines:
            lower = line.lower()
            if any(term in lower for term in ["preferred", "nice to have", "plus", "bonus", "desirable"]):
                in_preferred_section = True
                in_required_section = False
            elif any(term in lower for term in ["required", "must have", "minimum qualifications", "requirements", "what you need"]):
                in_required_section = True
                in_preferred_section = False

            for skill in detected_in_jd:
                # check if skill is on this line
                match_obj = next((item["regex"] for item in self.skill_lookup if item["name"] == skill), None)
                if match_obj and match_obj.search(line):
                    if in_preferred_section and skill not in preferred_skills:
                        preferred_skills.append(skill)
                    elif in_required_section and skill not in required_skills:
                        required_skills.append(skill)

        # Fallback if no specific sections found: First 60% are required, remaining are preferred
        if not required_skills and not preferred_skills and detected_in_jd:
            cutoff = max(1, int(len(detected_in_jd) * 0.65))
            required_skills = detected_in_jd[:cutoff]
            preferred_skills = detected_in_jd[cutoff:]
        elif not required_skills and detected_in_jd:
            required_skills = [s for s in detected_in_jd if s not in preferred_skills]

        # Extract experience years
        exp_match = re.search(r'(\d+)\+?\s*(?:to\s*(\d+))?\s*(?:years?|yrs?)(?:\s+of)?\s+experience', jd_text, re.IGNORECASE)
        years_required = int(exp_match.group(1)) if exp_match else 2

        # Extract education
        education_req = "Degree in Computer Science, Software Engineering or related field"
        if re.search(r'(master\'?s|m\.?s\.?|ph\.?d)', jd_text, re.IGNORECASE):
            education_req = "Master's or Ph.D. in Computer Science or related quantitative field"
        elif re.search(r'(bachelor\'?s|b\.?s\.?|b\.?tech|undergraduate)', jd_text, re.IGNORECASE):
            education_req = "Bachelor's degree in Computer Science, Engineering, or relevant technical field"

        # Detect likely role title
        role_title = "Software Engineer"
        for candidate_title in [
            "Full Stack Software Engineer", "Full Stack Developer", "Backend Systems Engineer",
            "Backend Developer", "Frontend Engineer", "Frontend Developer",
            "Machine Learning Engineer", "AI/ML Engineer", "Data Analyst",
            "Data Scientist", "DevOps Engineer", "Cloud Engineer", "Mobile Developer"
        ]:
            if re.search(r'\b' + re.escape(candidate_title) + r'\b', jd_text, re.IGNORECASE):
                role_title = candidate_title
                break

        return {
            "role_title": role_title,
            "required_skills": required_skills,
            "preferred_skills": preferred_skills,
            "all_jd_skills": detected_in_jd,
            "experience_years_required": years_required,
            "education_required": education_req,
            "word_count": len(jd_text.split())
        }
