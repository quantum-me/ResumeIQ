# ResumeIQ &mdash; Professional AI Career Intelligence Platform

> **Understand your resume. Match your potential. Build your next opportunity.**

ResumeIQ moves far beyond simplistic keyword counters. It treats your resume as an **evidence-based knowledge graph**, evaluating structural context, quantifiable accomplishments, and transparent alignment against industry job descriptions.

---

## 🌟 19 Built-In Platform Features

1. **Polished Landing & Navigation**: Executive, minimal interface inspired by modern tools (Vercel, Linear, Stripe) with responsive Dark/Light theme modes.
2. **Multi-Format Resume Upload**: Drag-and-drop parsing for **PDF**, **DOCX**, and plain text input.
3. **Resume Intelligence Engine**: Maps skills to domains (Backend, Frontend, Cloud/DevOps, AI/ML, Data) and validates structural context.
4. **Job Description Analyzer**: Extracts required qualifications, preferred competencies, required years of experience, and target roles.
5. **The Match Engine**: Multi-category breakdown scoring:
   - Technical Skills (35%)
   - Experience Match (20%)
   - Education Match (15%)
   - Projects Alignment (15%)
   - Keywords & Context (15%)
6. **Matched vs Missing Skills**: Provides context-aware advice for missing skills (e.g. recommending specific containerization projects for Docker) rather than sterile deficit lists.
7. **Skill Gap Analysis**: Classifies gaps into *Critical*, *Important*, and *Optional*, and crafts a structured career development roadmap.
8. **Resume Health Dashboard**: Granular 8-dimension scorecard evaluating content completeness, technical depth, formatting, and metrics.
9. **Resume Section Analyzer**: Independent scoring and diagnostic recommendations across Summary, Skills, Experience, Projects, and Education.
10. **Resume Improvement Assistant**: Interactive bullet rewriter that transforms weak sentences into the proven formula:
    `Action Verb + Technology + Problem/Scope + Quantifiable Result` across 3 tones (Metric-focused, Technical, Leadership).
11. **Job Role Recommendations with "Why?"**: Analyzes skill signatures and recommends top matching careers with plain-English justification.
12. **Multiple Job Comparison**: Compares 1 resume against 6 industry roles simultaneously in a side-by-side alignment matrix.
13. **"Why This Score?" Explainability**: Transparent breakdown of verified strengths and score-penalizing gaps.
14. **Resume Risk & Anti-Pattern Detector**: Uncovers red flags (missing contact info, weak verbs, missing metrics, unsupported skill dumps).
15. **Evidence-Based Skill Detection**: Flags whether skills are verified in work history, demonstrated in projects, or merely listed.
16. **Resume Evolution Tracking**: Compares Version 1 vs Version 2, tracking score deltas (`+17 points`), added tech stacks, and resolved risks.
17. **Career Application Tracker**: Integrated mini-CRM for tracking applications across *Saved*, *Applied*, *Interview*, *Offer*, and *Closed*.
18. **One-Click Executive PDF Report**: Generates a downloadable, publication-grade PDF report via Python's ReportLab.
19. **Instant Sample Presets**: 1-click loading for test profiles (Alex Rivera v2, Alex Rivera v1, and Priya Sharma - Data Analyst) so you can test and demonstrate the platform immediately.

---

## 🛠 System Architecture

```text
ResumeIQ/
├── app.py                     # Main Flask web server & REST API
├── resume_parser.py           # Multi-format text & structural extraction (PDF, DOCX, TXT)
├── skill_extractor.py         # Evidence mapping & taxonomy extractor
├── matcher.py                 # Multi-factor Match Engine with explainability
├── analyzer.py                # Health scorecard, section diagnostic & risk detector
├── recommendations.py         # Bullet rewriter, learning paths, role match & evolution
├── report_generator.py        # ReportLab PDF compilation engine
│
├── data/
│   ├── skills_database.json   # Comprehensive taxonomy across 400+ skills & synonyms
│   ├── job_roles.json         # Industry job specifications & requirement models
│   └── sample_resumes.json    # Ready-to-use sample profiles for instant testing
│
├── templates/
│   └── index.html             # Single-page interface with tab views
├── static/
│   ├── css/style.css          # Minimal + premium design system (Dark & Light)
│   └── js/app.js              # State manager, scanning animation & API connector
│
├── uploads/                   # Secure temporary upload directory
├── reports/                   # Compiled PDF reports
└── requirements.txt
```

---

## 🚀 Running the Application

1. Open PowerShell or Terminal in the `ResumeIQ` folder:
   ```powershell
   cd C:\Users\Pushmitha\.gemini\antigravity\scratch\ResumeIQ
   ```

2. Run the application:
   ```powershell
   python app.py
   ```

3. Open your browser and navigate to:
   ```text
   http://127.0.0.1:5000
   ```

4. Enjoy exploring your resume intelligence!
