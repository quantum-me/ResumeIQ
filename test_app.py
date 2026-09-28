"""
test_app.py - Automated verification test for ResumeIQ endpoints
"""

import json
from app import app

client = app.test_client()

def run_tests():
    print("Testing GET / ...")
    res = client.get('/')
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("[PASS] GET / passed")

    print("Testing GET /api/sample-resumes ...")
    res = client.get('/api/sample-resumes')
    assert res.status_code == 200
    data = res.get_json()
    assert len(data.get("samples", [])) >= 2
    print(f"[PASS] Found {len(data['samples'])} sample resumes")

    sample_resume = data["samples"][0]["raw_text"]

    print("Testing POST /api/upload (Analysis Pipeline) ...")
    res = client.post('/api/upload', json={"raw_text": sample_resume, "filename": "test_resume.txt"})
    assert res.status_code == 200
    upload_data = res.get_json()
    assert "skills_info" in upload_data
    assert "health" in upload_data
    assert "risks" in upload_data
    print(f"[PASS] Resume analysis passed! Health score: {upload_data['health']['overall_health']}, Skills found: {upload_data['skills_info']['total_skills_count']}")

    print("Testing POST /api/match-job ...")
    res = client.post('/api/match-job', json={
        "parsed_resume": {
            "contact": upload_data["contact"],
            "sections": upload_data["sections"],
            "raw_text": upload_data["raw_text"],
            "experience_bullets": upload_data["experience_bullets"],
            "project_bullets": upload_data["project_bullets"]
        },
        "skills_info": upload_data["skills_info"],
        "job_id": "swe_fullstack"
    })
    assert res.status_code == 200
    match_data = res.get_json()
    assert "match" in match_data
    print(f"[PASS] Match engine passed! Overall match: {match_data['match']['overall_match']}%, Matched: {match_data['match']['matched_count']}, Missing: {match_data['match']['missing_count']}")

    print("Testing POST /api/improve-bullet ...")
    res = client.post('/api/improve-bullet', json={
        "bullet": "Developed a machine learning project using Python."
    })
    assert res.status_code == 200
    rewrite_data = res.get_json()
    assert len(rewrite_data.get("variations", [])) == 3
    print("[PASS] Bullet rewriter passed with 3 professional variations")

    print("Testing POST /api/compare-multiple-jobs ...")
    res = client.post('/api/compare-multiple-jobs', json={
        "parsed_resume": {
            "contact": upload_data["contact"],
            "sections": upload_data["sections"],
            "raw_text": upload_data["raw_text"],
            "experience_bullets": upload_data["experience_bullets"],
            "project_bullets": upload_data["project_bullets"]
        },
        "skills_info": upload_data["skills_info"]
    })
    assert res.status_code == 200
    multi_data = res.get_json()
    assert len(multi_data.get("comparison", [])) >= 4
    print(f"[PASS] Multi-job comparison passed across {len(multi_data['comparison'])} roles")

    print("Testing POST /api/generate-pdf ...")
    res = client.post('/api/generate-pdf', json={
        "candidate_name": upload_data["contact"]["name"],
        "target_role": "Full Stack Software Engineer",
        "health": upload_data["health"],
        "match": match_data["match"],
        "skill_gap": match_data["skill_gap"]
    })
    assert res.status_code == 200
    pdf_res = res.get_json()
    assert "report_url" in pdf_res
    print(f"[PASS] Executive PDF generated at: {pdf_res['report_url']}")

    print("ALL TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    run_tests()
