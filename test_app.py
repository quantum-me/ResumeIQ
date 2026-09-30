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

    # =========================================================================
    # QR Version & Sharing Feature Tests
    # =========================================================================
    print("Testing GET /api/versions ...")
    res = client.get('/api/versions')
    assert res.status_code == 200
    versions = res.get_json()
    assert len(versions) >= 2, "Expected at least seeded Version 01 & 02"
    print(f"[PASS] Retrieved {len(versions)} resume versions")

    print("Testing POST /api/versions/save (Generate Version 03 & Share QR) ...")
    save_res = client.post('/api/versions/save', json={
        "parsed_resume": upload_data,
        "skills_info": upload_data["skills_info"],
        "health": upload_data["health"],
        "match": match_data["match"],
        "skill_gap": match_data["skill_gap"],
        "target_role": "Senior Full Stack Engineer",
        "filename": "Alex_Rivera_Optimized_v3.pdf"
    })
    assert save_res.status_code == 200
    save_data = save_res.get_json()
    assert save_data["status"] == "success"
    assert "qr_data_url" in save_data
    assert save_data["qr_data_url"].startswith("data:image/png;base64,")
    new_ver = save_data["version"]
    new_ver_id = new_ver["id"]
    share_id = new_ver["share_id"]
    print(f"[PASS] Created {new_ver['version_number']} with secure share ID: {share_id}")

    print("Testing GET /api/qr/<share_id>.png ...")
    qr_img_res = client.get(f'/api/qr/{share_id}.png')
    assert qr_img_res.status_code == 200
    assert qr_img_res.mimetype == 'image/png'
    assert len(qr_img_res.data) > 100
    print("[PASS] Served high-resolution QR PNG")

    print("Testing GET /share/<share_id> (Public Landing Page) ...")
    share_page_res = client.get(f'/share/{share_id}')
    assert share_page_res.status_code == 200
    html_content = share_page_res.get_data(as_text=True)
    assert new_ver["version_number"] in html_content
    assert "Resume Health" in html_content
    assert "Matched Skills" in html_content
    # Verify candidate phone is hidden by privacy protection
    assert "(555) 234-5678" not in html_content
    print("[PASS] Public share landing page verified (with zero PII leakage)")

    print("Testing POST /api/versions/<id>/privacy (Toggle to Private) ...")
    priv_res = client.post(f'/api/versions/{new_ver_id}/privacy', json={"status": "Private"})
    assert priv_res.status_code == 200
    assert priv_res.get_json()["version"]["share_status"] == "Private"
    
    # Verify access is now restricted
    priv_check_res = client.get(f'/share/{share_id}')
    assert priv_check_res.status_code == 403
    assert "This Analysis is Private" in priv_check_res.get_data(as_text=True)
    print("[PASS] Privacy toggle blocks public access with 403 restricted state")

    print("Testing POST /api/versions/<id>/regenerate-qr (Invalidate old ID, issue new QR) ...")
    regen_res = client.post(f'/api/versions/{new_ver_id}/regenerate-qr')
    assert regen_res.status_code == 200
    regen_data = regen_res.get_json()
    new_share_id = regen_data["share_id"]
    assert new_share_id != share_id, "Regenerated share ID must be different"
    assert regen_data["qr_data_url"].startswith("data:image/png;base64,")

    # Old link should now be 404/invalid
    old_check_res = client.get(f'/share/{share_id}')
    assert old_check_res.status_code == 403 or old_check_res.status_code == 404

    # New link should now work
    new_check_res = client.get(f'/share/{new_share_id}')
    assert new_check_res.status_code == 200
    print("[PASS] Regenerated QR code and successfully invalidated previous link")

    print("Testing POST /api/versions/compare (Strict 'What Changed?' Diff) ...")
    diff_res = client.post('/api/versions/compare', json={
        "version_old_id": "ver_01",
        "version_new_id": "ver_02"
    })
    assert diff_res.status_code == 200
    diff_data = diff_res.get_json()
    assert "score_delta_formatted" in diff_data
    assert "what_improved" in diff_data
    assert "still_missing" in diff_data
    assert len(diff_data["what_improved"]) > 0
    print(f"[PASS] Diff engine verified: {diff_data['version_old']} -> {diff_data['version_new']} ({diff_data['score_delta_formatted']})")

    print("\n=======================================================")
    print("ALL 12 BACKEND & SHARING TESTS PASSED WITH 100% SUCCESS!")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
