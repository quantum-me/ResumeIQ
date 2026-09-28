"""
app.py - Main Flask Application for ResumeIQ Career Intelligence Platform
Exposes REST APIs for resume parsing, evidence-based skill extraction, multi-dimensional
matching, section & health diagnostics, bullet rewriting, multi-job comparison, and PDF generation.
"""

import os
import uuid
import json
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename

from resume_parser import parse_resume, extract_text
from skill_extractor import SkillExtractor
from matcher import MatchEngine
from analyzer import ResumeAnalyzer
from recommendations import CareerAdvisor
from report_generator import generate_pdf_report

app = Flask(__name__)
app.config['SECRET_KEY'] = 'resumeiq-secret-key-2026'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['REPORTS_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt', 'md'}

# Initialize engines
skill_extractor = SkillExtractor()
match_engine = MatchEngine(skill_extractor)
analyzer = ResumeAnalyzer()
advisor = CareerAdvisor()

# In-memory storage for active sessions & job tracker
job_applications = [
    {
        "id": "app_1",
        "company": "Stripe",
        "role": "Software Engineer (Full Stack)",
        "match_score": 86,
        "resume_version": "v2",
        "status": "Interview",
        "date_added": "2026-09-24",
        "notes": "Completed technical screen. System design interview scheduled."
    },
    {
        "id": "app_2",
        "company": "Datadog",
        "role": "Backend Systems Engineer",
        "match_score": 82,
        "resume_version": "v2",
        "status": "Applied",
        "date_added": "2026-09-26",
        "notes": "Applied via referral link."
    },
    {
        "id": "app_3",
        "company": "Fintech Global",
        "role": "Data Analyst",
        "match_score": 74,
        "resume_version": "v1",
        "status": "Saved",
        "date_added": "2026-09-27",
        "notes": "Reviewing requirements for SQL query round."
    }
]


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/sample-resumes', methods=['GET'])
def get_sample_resumes():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'sample_resumes.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({"samples": []})


@app.route('/api/sample-jobs', methods=['GET'])
def get_sample_jobs():
    return jsonify(advisor.standard_roles)


@app.route('/api/upload', methods=['POST'])
def upload_resume():
    """
    Handles PDF/DOCX file upload or raw pasted text.
    Executes full pipeline:
    Extract text -> Parse sections -> Evidence-based skills -> Health score -> Risks -> Role recommendations
    """
    raw_text = ""
    filename = "pasted_resume.txt"

    if 'file' in request.files:
        file = request.files['file']
        if file and file.filename != '':
            if not allowed_file(file.filename):
                return jsonify({"error": "Unsupported file format. Please upload PDF, DOCX, or TXT."}), 400
            
            filename = secure_filename(file.filename)
            unique_name = f"{uuid.uuid4().hex[:8]}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            file.save(filepath)

            try:
                raw_text = extract_text(filepath)
            except Exception as e:
                return jsonify({"error": f"Failed to extract text from file: {str(e)}"}), 500
    
    if not raw_text and request.is_json:
        data = request.get_json()
        raw_text = data.get('raw_text', '')
        filename = data.get('filename', 'Direct Input')
    elif not raw_text and 'raw_text' in request.form:
        raw_text = request.form['raw_text']

    if not raw_text or len(raw_text.strip()) < 20:
        return jsonify({"error": "The resume text is empty or too short to analyze."}), 400

    # 1. Parse Resume Structure
    parsed = parse_resume(raw_text)

    # 2. Extract Skills with Evidence (Projects, Experience, Skills section)
    skills_info = skill_extractor.extract_skills_with_evidence(parsed)

    # 3. Analyze Health Scorecard
    health_scorecard = analyzer.analyze_health(parsed, skills_info)

    # 4. Section-by-Section Diagnostic
    section_diagnostics = analyzer.analyze_sections(parsed, skills_info)

    # 5. Risk & Anti-Pattern Detection
    risks_detected = analyzer.detect_risks(parsed, skills_info)

    # 6. Job Role Recommendations with 'Why?'
    role_recommendations = advisor.recommend_roles(skills_info.get("skill_names", []))

    response_data = {
        "status": "success",
        "filename": filename,
        "contact": parsed["contact"],
        "word_count": parsed["word_count"],
        "sections": parsed["sections"],
        "skills_info": skills_info,
        "health": health_scorecard,
        "section_diagnostics": section_diagnostics,
        "risks": risks_detected,
        "role_recommendations": role_recommendations,
        "experience_bullets": parsed["experience_bullets"][:6],
        "project_bullets": parsed["project_bullets"][:6],
        "raw_text": raw_text
    }

    return jsonify(response_data)


@app.route('/api/match-job', methods=['POST'])
def match_job():
    """
    Matches current parsed resume against a job description.
    Accepts:
    {
      "parsed_resume": {...},
      "skills_info": {...},
      "jd_text": "...",
      "job_id": "swe_fullstack" (optional)
    }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload received"}), 400

    parsed_resume = data.get("parsed_resume", {})
    skills_info = data.get("skills_info", {})
    jd_text = data.get("jd_text", "")
    job_id = data.get("job_id", "")

    # If job_id is provided from standard roles
    selected_role = None
    if job_id:
        for r in advisor.standard_roles:
            if r["id"] == job_id:
                selected_role = r
                break

    if selected_role and not jd_text:
        jd_text = selected_role["description"] + " Requirements: " + ", ".join(selected_role["required_skills"]) + ". Preferred: " + ", ".join(selected_role["preferred_skills"])

    if not jd_text:
        return jsonify({"error": "Please provide a job description or select a standard role."}), 400

    # 1. Parse JD
    jd_info = skill_extractor.extract_from_job_description(jd_text)
    if selected_role:
        jd_info["role_title"] = selected_role["title"]
        jd_info["required_skills"] = selected_role["required_skills"]
        jd_info["preferred_skills"] = selected_role["preferred_skills"]
        jd_info["experience_years_required"] = selected_role.get("min_experience_years", 2)

    # 2. Run Match Engine
    match_result = match_engine.match(parsed_resume, skills_info, jd_info)

    # 3. Build Skill Gap & Career Roadmap
    skill_gap_result = advisor.build_skill_gap_analysis(match_result["missing_skills"])

    return jsonify({
        "status": "success",
        "jd_info": jd_info,
        "match": match_result,
        "skill_gap": skill_gap_result
    })


@app.route('/api/compare-multiple-jobs', methods=['POST'])
def compare_multiple_jobs():
    """
    Compares 1 resume against all standard roles or a list of custom JDs.
    Returns comparison matrix.
    """
    data = request.get_json()
    parsed_resume = data.get("parsed_resume", {})
    skills_info = data.get("skills_info", {})

    results = []
    for role in advisor.standard_roles:
        jd_info = {
            "role_title": role["title"],
            "required_skills": role["required_skills"],
            "preferred_skills": role["preferred_skills"],
            "all_jd_skills": role["required_skills"] + role["preferred_skills"],
            "experience_years_required": role.get("min_experience_years", 2)
        }
        res = match_engine.match(parsed_resume, skills_info, jd_info)
        results.append({
            "job_id": role["id"],
            "title": role["title"],
            "company": role.get("company", "Industry Standard"),
            "level": role.get("level", "Mid-Level"),
            "overall_match": res["overall_match"],
            "technical_match": res["category_scores"]["technical_skills"],
            "experience_match": res["category_scores"]["experience"],
            "matched_count": res["matched_count"],
            "missing_count": res["missing_count"],
            "key_strengths": res["strengths"][:2],
            "key_gaps": [m["name"] for m in res["missing_skills"][:3]]
        })

    results.sort(key=lambda x: x["overall_match"], reverse=True)
    return jsonify({"comparison": results})


@app.route('/api/improve-bullet', methods=['POST'])
def improve_bullet():
    """
    Improves a weak resume bullet point into the Action + Tech + Scope + Result format.
    """
    data = request.get_json()
    bullet = data.get("bullet", "")
    if not bullet:
        return jsonify({"error": "No bullet text provided."}), 400

    result = advisor.improve_sentence(bullet)
    return jsonify(result)


@app.route('/api/compare-versions', methods=['POST'])
def compare_versions():
    """
    Compares two resume versions (v1 vs v2).
    """
    data = request.get_json()
    v1_data = data.get("v1", {})
    v2_data = data.get("v2", {})
    comparison = advisor.compare_resume_versions(v1_data, v2_data)
    return jsonify(comparison)


@app.route('/api/generate-pdf', methods=['POST'])
def generate_pdf():
    """
    Generates an executive PDF report and saves it in the reports folder.
    """
    data = request.get_json()
    candidate_name = data.get("candidate_name", "Candidate")
    target_role = data.get("target_role", "Software Engineer")
    health_data = data.get("health", {})
    match_data = data.get("match", {})
    skill_gap_data = data.get("skill_gap", {})

    report_id = f"ResumeIQ_Report_{uuid.uuid4().hex[:8]}.pdf"
    output_path = os.path.join(app.config['REPORTS_FOLDER'], report_id)

    try:
        generate_pdf_report(
            candidate_name=candidate_name,
            target_role=target_role,
            health_data=health_data,
            match_data=match_data,
            skill_gap_data=skill_gap_data,
            output_path=output_path
        )
        return jsonify({
            "status": "success",
            "report_url": f"/api/download-report/{report_id}",
            "filename": report_id
        })
    except Exception as e:
        return jsonify({"error": f"Failed to generate PDF: {str(e)}"}), 500


@app.route('/api/download-report/<filename>', methods=['GET'])
def download_report(filename):
    clean_name = secure_filename(filename)
    return send_from_directory(app.config['REPORTS_FOLDER'], clean_name, as_attachment=True)


# Job Application Tracker APIs
@app.route('/api/applications', methods=['GET'])
def get_applications():
    return jsonify(job_applications)


@app.route('/api/applications', methods=['POST'])
def add_application():
    data = request.get_json()
    new_app = {
        "id": f"app_{uuid.uuid4().hex[:6]}",
        "company": data.get("company", "Company"),
        "role": data.get("role", "Target Role"),
        "match_score": data.get("match_score", 75),
        "resume_version": data.get("resume_version", "v1"),
        "status": data.get("status", "Saved"),
        "date_added": datetime.now().strftime("%Y-%m-%d"),
        "notes": data.get("notes", "")
    }
    job_applications.insert(0, new_app)
    return jsonify({"status": "success", "application": new_app})


@app.route('/api/applications/<app_id>', methods=['PUT'])
def update_application(app_id):
    data = request.get_json()
    for app_item in job_applications:
        if app_item["id"] == app_id:
            if "status" in data:
                app_item["status"] = data["status"]
            if "notes" in data:
                app_item["notes"] = data["notes"]
            return jsonify({"status": "success", "application": app_item})
    return jsonify({"error": "Application not found"}), 404


@app.route('/api/applications/<app_id>', methods=['DELETE'])
def delete_application(app_id):
    global job_applications
    job_applications = [a for a in job_applications if a["id"] != app_id]
    return jsonify({"status": "success"})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting ResumeIQ Server on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
