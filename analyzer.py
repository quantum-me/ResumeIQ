"""
analyzer.py - Resume Health Dashboard, Section Analyzer, and Risk Detector
Computes overall health scorecard, section-by-section breakdown, and detects red flags / ATS risks.
"""

import re
from typing import Dict, Any, List


class ResumeAnalyzer:
    def __init__(self):
        # Action verbs for high-impact achievements
        self.action_verbs = {
            "architected", "engineered", "spearheaded", "designed", "developed",
            "implemented", "accelerated", "reduced", "scaled", "automated",
            "slashed", "optimized", "delivered", "orchestrated", "transformed",
            "launched", "constructed", "integrated", "boosted", "maximized"
        }

    def analyze_health(self, parsed_resume: Dict[str, Any], skills_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates granular 8-dimension health scorecard out of 100.
        """
        sections = parsed_resume.get("sections", {})
        raw_text = parsed_resume.get("raw_text", "")
        contact = parsed_resume.get("contact", {})
        total_skills = skills_info.get("total_skills_count", 0)
        exp_bullets = parsed_resume.get("experience_bullets", [])
        proj_bullets = parsed_resume.get("project_bullets", [])

        # 1. Content Completeness
        has_summary = len(sections.get("summary", "")) > 30
        has_skills = total_skills >= 5
        has_exp = len(exp_bullets) >= 2
        has_proj = len(proj_bullets) >= 1
        has_edu = len(sections.get("education", "")) > 20
        has_contact = (contact.get("email") != "Not detected") and (contact.get("phone") != "Not detected")
        
        completeness_checks = [has_summary, has_skills, has_exp, has_proj, has_edu, has_contact]
        content_completeness = round((sum(completeness_checks) / len(completeness_checks)) * 100)

        # 2. Technical Skills Depth
        evidence_breakdown = skills_info.get("evidence_breakdown", {})
        high_ev = evidence_breakdown.get("high", 0)
        med_ev = evidence_breakdown.get("medium", 0)
        if total_skills >= 10 and (high_ev + med_ev >= 6):
            skills_depth = 94
        elif total_skills >= 6 and (high_ev + med_ev >= 3):
            skills_depth = 84
        elif total_skills >= 4:
            skills_depth = 72
        else:
            skills_depth = 55

        # 3. Project Strength
        if len(proj_bullets) >= 4 and any(re.search(r'\b(api|app|system|pipeline|engine|platform|model)\b', b.lower()) for b in proj_bullets):
            project_strength = 90
        elif len(proj_bullets) >= 2:
            project_strength = 82
        elif len(proj_bullets) >= 1:
            project_strength = 70
        else:
            project_strength = 45

        # 4. Experience Clarity
        if len(exp_bullets) >= 4:
            experience_clarity = 88
        elif len(exp_bullets) >= 2:
            experience_clarity = 78
        elif len(exp_bullets) >= 1:
            experience_clarity = 65
        else:
            experience_clarity = 50

        # 5. Keyword Coverage
        if total_skills >= 12 and len(skills_info.get("top_domains", [])) >= 3:
            keyword_coverage = 88
        elif total_skills >= 7:
            keyword_coverage = 76
        else:
            keyword_coverage = 60

        # 6. Formatting & Readability
        # Deduct if text is too sparse or cluttered
        words = len(raw_text.split())
        if 250 <= words <= 900:
            formatting = 94
        elif 150 <= words < 250:
            formatting = 78
        else:
            formatting = 68

        # 7. Achievement & Measurable Impact (Metrics, %, $, numbers)
        all_bullets = exp_bullets + proj_bullets
        measurable_bullets = [
            b for b in all_bullets
            if re.search(r'(\d+%\s*|\$\s*\d+|\b\d+\s*(?:ms|k|m|million|thousand|users|requests|endpoints|times|x)\b|\b\d+\+)', b, re.IGNORECASE)
        ]
        if all_bullets:
            metric_ratio = len(measurable_bullets) / len(all_bullets)
            if metric_ratio >= 0.5:
                achievement_clarity = 92
            elif metric_ratio >= 0.25:
                achievement_clarity = 78
            elif metric_ratio > 0:
                achievement_clarity = 65
            else:
                achievement_clarity = 42
        else:
            achievement_clarity = 40

        # 8. Section Structure
        recognized_sections = sum(1 for sec, text in sections.items() if sec != "header" and sec != "other" and len(text) > 10)
        section_structure = round(min(100, (recognized_sections / 5.0) * 96))

        # Overall Health Score
        overall_health = round(
            (content_completeness * 0.15) +
            (skills_depth * 0.15) +
            (project_strength * 0.15) +
            (experience_clarity * 0.15) +
            (keyword_coverage * 0.10) +
            (formatting * 0.10) +
            (achievement_clarity * 0.10) +
            (section_structure * 0.10)
        )
        overall_health = max(30, min(99, overall_health))

        return {
            "overall_health": overall_health,
            "metrics": {
                "content_completeness": content_completeness,
                "skills_depth": skills_depth,
                "project_strength": project_strength,
                "experience_clarity": experience_clarity,
                "keyword_coverage": keyword_coverage,
                "formatting": formatting,
                "achievement_clarity": achievement_clarity,
                "section_structure": section_structure
            },
            "metrics_list": [
                {"name": "Content Completeness", "score": content_completeness, "desc": "Presence of essential contact, education, and career details"},
                {"name": "Technical Skill Depth", "score": skills_depth, "desc": "Evidence-backed technology mentions across projects"},
                {"name": "Project Strength", "score": project_strength, "desc": "Complexity and clarity of listed technical projects"},
                {"name": "Experience Clarity", "score": experience_clarity, "desc": "Structured career timeline and bullet point quality"},
                {"name": "Keyword Coverage", "score": keyword_coverage, "desc": "Taxonomy distribution across languages, tools, and domains"},
                {"name": "Formatting & ATS Readability", "score": formatting, "desc": "Scannable length, standard headers, and hierarchy"},
                {"name": "Achievement Clarity", "score": achievement_clarity, "desc": "Quantified outcomes, percentages, scale, and performance metrics"},
                {"name": "Section Structure", "score": section_structure, "desc": "Logical section headings and clean organization"}
            ],
            "measurable_bullets_count": len(measurable_bullets),
            "total_bullets_count": len(all_bullets)
        }

    def analyze_sections(self, parsed_resume: Dict[str, Any], skills_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Analyzes every section independently with targeted feedback.
        """
        sections = parsed_resume.get("sections", {})
        exp_bullets = parsed_resume.get("experience_bullets", [])
        proj_bullets = parsed_resume.get("project_bullets", [])
        total_skills = skills_info.get("total_skills_count", 0)

        results = []

        # 1. Summary Section
        summary_text = sections.get("summary", "")
        if len(summary_text) > 80:
            if any(term in summary_text.lower() for term in ["years", "engineer", "developer", "specialized", "scaling"]):
                summary_score = 88
                summary_feedback = "Strong concise overview emphasizing specialization and core capabilities."
            else:
                summary_score = 75
                summary_feedback = "Good foundation, but could better communicate technical focus and quantifiable career highlights."
        elif len(summary_text) > 20:
            summary_score = 64
            summary_feedback = "A bit brief. Expand to 2-3 sentences highlighting your specialization, years of experience, and primary stack."
        else:
            summary_score = 45
            summary_feedback = "Missing or minimal. Adding a professional summary boosts ATS ranking and gives recruiters an immediate value proposition."
        
        results.append({
            "section": "Summary / Objective",
            "score": summary_score,
            "status": "Strong" if summary_score >= 80 else ("Needs Polish" if summary_score >= 60 else "Attention"),
            "feedback": summary_feedback
        })

        # 2. Technical Skills Section
        if total_skills >= 10:
            skills_score = 92
            skills_feedback = f"Excellent technical coverage with {total_skills} recognized industry technologies. Nicely categorized across domains."
        elif total_skills >= 5:
            skills_score = 80
            skills_feedback = f"Good foundational stack ({total_skills} skills detected). Ensure tools are categorized into Languages, Frameworks, and Cloud."
        else:
            skills_score = 58
            skills_feedback = "Limited technical keywords detected. Expand to include databases, development tools, and frameworks."

        results.append({
            "section": "Skills & Tech Stack",
            "score": skills_score,
            "status": "Strong" if skills_score >= 80 else "Needs Polish",
            "feedback": skills_feedback
        })

        # 3. Experience Section
        action_verb_count = sum(
            1 for b in exp_bullets
            if any(b.lower().strip().startswith(v) for v in self.action_verbs)
        )
        metric_count = sum(1 for b in exp_bullets if re.search(r'\d', b))

        if len(exp_bullets) >= 3 and metric_count >= 2:
            exp_score = 89
            exp_feedback = "Strong accomplishments with measurable impact and active power verbs."
        elif len(exp_bullets) >= 2:
            exp_score = 78
            exp_feedback = "Clear responsibilities present. Consider reinforcing bullet points with quantifiable business impact (%, latency, users)."
        else:
            exp_score = 55
            exp_feedback = "Sparse experience section. Detail responsibilities, technical challenges solved, and team contributions."

        results.append({
            "section": "Professional Experience",
            "score": exp_score,
            "status": "Strong" if exp_score >= 80 else ("Needs Polish" if exp_score >= 60 else "Attention"),
            "feedback": exp_feedback
        })

        # 4. Projects Section
        if len(proj_bullets) >= 3:
            proj_score = 88
            proj_feedback = "Impressive project representation demonstrating practical application of key technologies."
        elif len(proj_bullets) >= 1:
            proj_score = 80
            proj_feedback = "Good projects noted; mention architecture choices, scale, and live links or repos for added credibility."
        else:
            proj_score = 52
            proj_feedback = "No distinct projects section identified. Including 2-3 tangible projects significantly strengthens junior to mid-level resumes."

        results.append({
            "section": "Projects & Portfolio",
            "score": proj_score,
            "status": "Strong" if proj_score >= 80 else "Attention",
            "feedback": proj_feedback
        })

        # 5. Education & Certifications
        edu_text = sections.get("education", "")
        certs_text = sections.get("certifications", "")
        has_degree = bool(re.search(r'(bachelor|degree|b\.s|b\.tech|master|m\.s|university|college)', edu_text, re.IGNORECASE))

        if has_degree and len(certs_text) > 10:
            edu_score = 96
            edu_feedback = "Clear academic degree plus verified certifications that signal ongoing professional growth."
        elif has_degree:
            edu_score = 88
            edu_feedback = "Degree credentials clearly recognized and properly positioned."
        elif len(edu_text) > 10:
            edu_score = 75
            edu_feedback = "Education noted. Ensure degree title, institution, and graduation year are explicitly formatted."
        else:
            edu_score = 50
            edu_feedback = "Education credentials difficult to parse. Include standard degree and institution titles."

        results.append({
            "section": "Education & Credentials",
            "score": edu_score,
            "status": "Strong" if edu_score >= 80 else "Needs Polish",
            "feedback": edu_feedback
        })

        return results

    def detect_risks(self, parsed_resume: Dict[str, Any], skills_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Resume Risk Detector: Identifies anti-patterns, ATS formatting pitfalls, and omissions.
        Returns a list of structured risk cards with severity, issue, and concrete fix.
        """
        risks = []
        contact = parsed_resume.get("contact", {})
        sections = parsed_resume.get("sections", {})
        exp_bullets = parsed_resume.get("experience_bullets", [])
        proj_bullets = parsed_resume.get("project_bullets", [])
        all_bullets = exp_bullets + proj_bullets
        total_skills = skills_info.get("total_skills_count", 0)
        evidence_breakdown = skills_info.get("evidence_breakdown", {})

        # Risk 1: Contact info gaps
        if contact.get("email") == "Not detected":
            risks.append({
                "severity": "Critical",
                "title": "Email Address Missing",
                "detail": "No valid email address was detected in the header. ATS and recruiters need direct contact information.",
                "fix": "Place your professional email address prominently at the top of your resume."
            })
        if contact.get("phone") == "Not detected":
            risks.append({
                "severity": "Important",
                "title": "Phone Number Missing",
                "detail": "Recruiters frequently screen candidates via phone or SMS.",
                "fix": "Include standard phone number with country/area code in the header."
            })
        if contact.get("linkedin") == "Not detected" and contact.get("github") == "Not detected":
            risks.append({
                "severity": "Moderate",
                "title": "No Online Profiles (GitHub/LinkedIn) Detected",
                "detail": "Tech recruiters strongly prefer viewing public GitHub repositories and active LinkedIn profiles.",
                "fix": "Add clean hyperlinks to your GitHub and LinkedIn profiles near the contact header."
            })

        # Risk 2: Measurable impact deficiency
        metrics_found = sum(1 for b in all_bullets if re.search(r'(\d+%\s*|\$\s*\d+|\b\d+\s*(?:ms|k|m|users|requests)\b)', b, re.IGNORECASE))
        if all_bullets and metrics_found == 0:
            risks.append({
                "severity": "Critical",
                "title": "Missing Quantifiable Results",
                "detail": "Bullet points list tasks and responsibilities rather than measurable business outcomes.",
                "fix": "Use the formula: 'Accomplished [X] as measured by [Y] by doing [Z]'. Add metrics like % latency reduced or $ saved."
            })

        # Risk 3: Unsupported Skill Dump
        basic_skills_count = evidence_breakdown.get("basic_or_low", 0)
        if total_skills >= 8 and (basic_skills_count / total_skills) > 0.70:
            risks.append({
                "severity": "Moderate",
                "title": "Skill Dump Without Evidence",
                "detail": f"{basic_skills_count} out of {total_skills} listed skills have no supporting context in your projects or work history.",
                "fix": "Connect key technologies directly to real projects or work experience bullets to validate proficiency."
            })

        # Risk 4: Very short project descriptions
        short_projs = [b for b in proj_bullets if len(b.split()) < 6]
        if short_projs:
            risks.append({
                "severity": "Minor",
                "title": "Ultra-Short Project Descriptions",
                "detail": f"{len(short_projs)} project bullet points contain fewer than 6 words, providing insufficient detail for ATS parsing.",
                "fix": "Expand each project point with context on the problem, technical stack used, and the final deliverable."
            })

        # Risk 5: Passive Voice / Weak Verbs
        weak_starters = ["worked on", "helped with", "assisted in", "responsible for", "made a"]
        passive_bullets = [b for b in all_bullets if any(b.lower().strip().startswith(w) for w in weak_starters)]
        if passive_bullets:
            risks.append({
                "severity": "Important",
                "title": "Passive Language Detected",
                "detail": f"Found {len(passive_bullets)} bullet point(s) starting with passive phrases like 'worked on' or 'helped with'.",
                "fix": "Replace with strong action verbs such as 'Architected', 'Spearheaded', 'Optimized', or 'Engineered'."
            })

        return risks
