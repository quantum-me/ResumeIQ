/**
 * app.js - ResumeIQ Interactive Frontend Controller
 * Handles resume uploads, scanning pipeline, tab navigation, match diagnostics,
 * bullet rewriter, multi-job comparison, evolution tracking, and PDF report triggers.
 */

// Global State
const state = {
  theme: localStorage.getItem('resumeiq_theme') || 'dark',
  currentTab: 'dashboard',
  parsedResume: null,
  skillsInfo: null,
  healthData: null,
  sectionDiagnostics: null,
  risks: [],
  roleRecommendations: [],
  currentMatch: null,
  currentSkillGap: null,
  sampleResumes: [],
  standardJobs: [],
  applications: [],
  v1Snapshot: null,
  v2Snapshot: null
};

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  loadSampleResumes();
  loadStandardJobs();
  loadApplications();
  
  // Auto-load high-quality Alex Rivera v2 sample on initial load so the dashboard is immediately populated!
  setTimeout(() => {
    loadSampleById('alex_rivera_v2');
  }, 300);
});

/* ==========================================================================
   Theme Management
   ========================================================================== */
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.innerHTML = state.theme === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('resumeiq_theme', state.theme);
  initTheme();
}

/* ==========================================================================
   Tab Navigation
   ========================================================================== */
function switchTab(tabId) {
  state.currentTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.dataset.tab === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update views
  document.querySelectorAll('.view-section').forEach(view => {
    if (view.id === `view-${tabId}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // If switching to multi-job or evolution, refresh them
  if (tabId === 'multijob' && state.parsedResume) {
    runMultiJobComparison();
  } else if (tabId === 'evolution') {
    renderEvolutionView();
  }
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */
function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabId = e.currentTarget.dataset.tab;
      switchTab(tabId);
    });
  });

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }

  // File Upload Dropzone
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        uploadFile(e.target.files[0]);
      }
    });
  }

  // Paste Text Button
  const btnAnalyzePasted = document.getElementById('btn-analyze-pasted');
  if (btnAnalyzePasted) {
    btnAnalyzePasted.addEventListener('click', () => {
      const text = document.getElementById('pasted-resume-text').value;
      if (!text || text.trim().length < 20) {
        alert('Please paste a resume text with at least a few lines.');
        return;
      }
      analyzeRawText(text, 'Pasted Resume');
    });
  }

  // Job Match Selector
  const jobSelect = document.getElementById('match-role-select');
  if (jobSelect) {
    jobSelect.addEventListener('change', (e) => {
      const jobId = e.target.value;
      triggerJobMatch(jobId);
    });
  }

  // Custom JD Analyze Button
  const btnMatchCustomJd = document.getElementById('btn-match-custom-jd');
  if (btnMatchCustomJd) {
    btnMatchCustomJd.addEventListener('click', () => {
      const jdText = document.getElementById('custom-jd-text').value;
      if (!jdText || jdText.trim().length < 20) {
        alert('Please paste a job description to match.');
        return;
      }
      triggerJobMatch(null, jdText);
    });
  }

  // Sentence Rewriter Button
  const btnRewrite = document.getElementById('btn-rewrite-bullet');
  if (btnRewrite) {
    btnRewrite.addEventListener('click', () => {
      const bullet = document.getElementById('input-bullet-rewrite').value;
      if (!bullet.trim()) {
        alert('Please enter or select a sentence to improve.');
        return;
      }
      requestBulletRewrite(bullet);
    });
  }

  // Download PDF Button
  const btnDownloadPdf = document.getElementById('btn-download-pdf-report');
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', triggerPdfDownload);
  }

  // Add to tracker button
  const btnTrackJob = document.getElementById('btn-track-current-match');
  if (btnTrackJob) {
    btnTrackJob.addEventListener('click', trackCurrentMatch);
  }
}

/* ==========================================================================
   Sample Data Loading
   ========================================================================== */
async function loadSampleResumes() {
  try {
    const res = await fetch('/api/sample-resumes');
    const data = await res.json();
    state.sampleResumes = data.samples || [];

    const container = document.getElementById('sample-pills-container');
    if (container && state.sampleResumes.length > 0) {
      container.innerHTML = state.sampleResumes.map(s => `
        <button class="sample-pill" onclick="loadSampleById('${s.id}')">
          👤 ${s.name} (${s.version})
        </button>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading sample resumes:', err);
  }
}

async function loadStandardJobs() {
  try {
    const res = await fetch('/api/sample-jobs');
    const jobs = await res.json();
    state.standardJobs = jobs || [];

    const select = document.getElementById('match-role-select');
    if (select) {
      select.innerHTML = state.standardJobs.map((j, i) => `
        <option value="${j.id}" ${i === 0 ? 'selected' : ''}>${j.title} (${j.level})</option>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading standard jobs:', err);
  }
}

function loadSampleById(sampleId) {
  const sample = state.sampleResumes.find(s => s.id === sampleId);
  if (!sample) return;
  document.getElementById('pasted-resume-text').value = sample.raw_text;
  analyzeRawText(sample.raw_text, `${sample.name} (${sample.version})`);
}

/* ==========================================================================
   Resume Analysis Pipeline & Scanning Animation
   ========================================================================== */
function showScanningOverlay(show = true) {
  const overlay = document.getElementById('scanning-overlay');
  if (overlay) {
    overlay.style.display = show ? 'block' : 'none';
  }
}

function updateScanStep(stepIndex) {
  const steps = document.querySelectorAll('.pipeline-step');
  steps.forEach((step, idx) => {
    if (idx < stepIndex) {
      step.className = 'pipeline-step done';
      step.querySelector('.step-icon').textContent = '✓';
    } else if (idx === stepIndex) {
      step.className = 'pipeline-step active';
      step.querySelector('.step-icon').textContent = '➔';
    } else {
      step.className = 'pipeline-step';
      step.querySelector('.step-icon').textContent = '○';
    }
  });
}

async function uploadFile(file) {
  showScanningOverlay(true);
  updateScanStep(0);

  const formData = new FormData();
  formData.append('file', file);

  try {
    setTimeout(() => updateScanStep(1), 300);
    setTimeout(() => updateScanStep(2), 700);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    updateScanStep(3);
    setTimeout(() => {
      updateScanStep(4);
      processUploadSuccess(data);
      showScanningOverlay(false);
    }, 600);
  } catch (err) {
    showScanningOverlay(false);
    alert('Error analyzing resume: ' + err.message);
  }
}

async function analyzeRawText(text, filename = 'Direct Input') {
  showScanningOverlay(true);
  updateScanStep(0);

  try {
    setTimeout(() => updateScanStep(1), 250);
    setTimeout(() => updateScanStep(2), 550);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: text, filename: filename })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Analysis failed');
    }

    updateScanStep(3);
    setTimeout(() => {
      updateScanStep(4);
      processUploadSuccess(data);
      showScanningOverlay(false);
    }, 500);
  } catch (err) {
    showScanningOverlay(false);
    alert('Error analyzing resume: ' + err.message);
  }
}

function processUploadSuccess(data) {
  state.parsedResume = {
    contact: data.contact,
    sections: data.sections,
    experience_bullets: data.experience_bullets,
    project_bullets: data.project_bullets,
    raw_text: data.raw_text,
    word_count: data.word_count
  };
  state.skillsInfo = data.skills_info;
  state.healthData = data.health;
  state.sectionDiagnostics = data.section_diagnostics;
  state.risks = data.risks;
  state.roleRecommendations = data.role_recommendations;

  // Manage snapshots for evolution
  if (!state.v1Snapshot) {
    state.v1Snapshot = {
      version: 'v1',
      health_score: data.health.overall_health,
      skills: data.skills_info.skill_names,
      measurable_bullets: data.health.measurable_bullets_count,
      risks_count: data.risks.length
    };
  } else if (!state.v2Snapshot && state.v1Snapshot.health_score !== data.health.overall_health) {
    state.v2Snapshot = {
      version: 'v2',
      health_score: data.health.overall_health,
      skills: data.skills_info.skill_names,
      measurable_bullets: data.health.measurable_bullets_count,
      risks_count: data.risks.length
    };
  }

  // Populate UI views
  renderDashboard();
  renderResumeDiagnostic();
  renderSectionAnalyzer();
  renderRiskDetector();
  populateRewriterPresets();

  // Run initial job match against the first standard job
  const defaultJobId = document.getElementById('match-role-select')?.value || 'swe_fullstack';
  triggerJobMatch(defaultJobId);
}

/* ==========================================================================
   Dashboard View Rendering
   ========================================================================== */
function renderDashboard() {
  if (!state.parsedResume || !state.healthData) return;

  const contact = state.parsedResume.contact;
  document.getElementById('dash-candidate-name').textContent = contact.name || 'Candidate';
  document.getElementById('dash-contact-summary').textContent = `${contact.email} • ${contact.phone}`;

  // Health Circular Gauge
  const score = state.healthData.overall_health;
  document.getElementById('dash-health-number').textContent = score;
  setCircleGauge('dash-health-gauge', score);

  // Key metric summaries
  const m = state.healthData.metrics;
  document.getElementById('dash-skills-score').textContent = `${m.skills_depth}%`;
  document.getElementById('dash-projects-score').textContent = `${m.project_strength}%`;
  document.getElementById('dash-keywords-score').textContent = `${m.keyword_coverage}%`;
  document.getElementById('dash-quantified-score').textContent = `${m.achievement_clarity}%`;

  // Top domains tags
  const domainContainer = document.getElementById('dash-top-domains');
  if (domainContainer) {
    const domains = state.skillsInfo.top_domains || [];
    domainContainer.innerHTML = domains.slice(0, 4).map(([dom, count]) => `
      <span class="badge badge-info">${dom} (${count})</span>
    `).join('');
  }

  // Top Role Recommendation
  if (state.roleRecommendations && state.roleRecommendations.length > 0) {
    const topRole = state.roleRecommendations[0];
    document.getElementById('dash-recommended-role').textContent = topRole.role_title;
    document.getElementById('dash-recommended-alignment').textContent = `${topRole.alignment} (${topRole.alignment_score}%)`;
    document.getElementById('dash-recommended-why').textContent = topRole.why;
  }
}

function setCircleGauge(elementId, score) {
  const circle = document.getElementById(elementId);
  if (circle) {
    const radius = 15.9155;
    const circumference = 100;
    circle.setAttribute('stroke-dasharray', `${score}, ${circumference}`);
  }
}

/* ==========================================================================
   Resume Diagnostic View Rendering
   ========================================================================== */
function renderResumeDiagnostic() {
  if (!state.parsedResume || !state.skillsInfo) return;

  // Contact Info Cards
  const c = state.parsedResume.contact;
  document.getElementById('diag-name').textContent = c.name;
  document.getElementById('diag-email').textContent = c.email;
  document.getElementById('diag-phone').textContent = c.phone;
  document.getElementById('diag-github').textContent = c.github;
  document.getElementById('diag-linkedin').textContent = c.linkedin;

  // Evidence Breakdown Counter
  const eb = state.skillsInfo.evidence_breakdown;
  document.getElementById('ev-high-count').textContent = eb.high;
  document.getElementById('ev-med-count').textContent = eb.medium;
  document.getElementById('ev-basic-count').textContent = eb.basic_or_low;

  // Render Categorized Skills with Evidence Tags
  const container = document.getElementById('diag-skills-by-category');
  if (container) {
    const cats = state.skillsInfo.skills_by_category;
    let html = '';
    for (const [catName, skills] of Object.entries(cats)) {
      html += `
        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.6rem; font-weight: 600;">
            ${catName} (${skills.length})
          </h4>
          <div class="skill-pills">
            ${skills.map(s => {
              const dotClass = s.evidence_level === 'High' ? 'dot-high' : (s.evidence_level === 'Medium' ? 'dot-medium' : 'dot-basic');
              return `
                <div class="skill-tag" title="${s.evidence_label}: ${s.sample_evidence}">
                  <span class="skill-dot ${dotClass}"></span>
                  <strong>${s.name}</strong>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">${s.evidence_level}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  // 8 Health Metrics Progress Bars
  const healthListContainer = document.getElementById('diag-health-metrics-list');
  if (healthListContainer && state.healthData) {
    healthListContainer.innerHTML = state.healthData.metrics_list.map(item => `
      <div class="metric-row">
        <div class="metric-header">
          <span class="metric-name" title="${item.desc}">${item.name}</span>
          <span class="metric-val">${item.score}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar ${item.score >= 80 ? 'success' : (item.score >= 65 ? '' : 'warning')}" style="width: ${item.score}%"></div>
        </div>
      </div>
    `).join('');
  }
}

/* ==========================================================================
   Job Match Engine
   ========================================================================== */
async function triggerJobMatch(jobId = null, customJdText = null) {
  if (!state.parsedResume) return;

  const payload = {
    parsed_resume: state.parsedResume,
    skills_info: state.skillsInfo,
    job_id: jobId,
    jd_text: customJdText
  };

  try {
    const res = await fetch('/api/match-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Matching failed');
    }

    state.currentMatch = data.match;
    state.currentSkillGap = data.skill_gap;
    renderJobMatchResults(data);
    renderSkillGapResults(data.skill_gap);
  } catch (err) {
    console.error('Job match error:', err);
  }
}

function renderJobMatchResults(data) {
  const match = data.match;
  const jd = data.jd_info;

  // Overall Match Gauge
  document.getElementById('match-overall-score').textContent = `${match.overall_match}%`;
  setCircleGauge('match-gauge-circle', match.overall_match);
  document.getElementById('match-target-role-title').textContent = jd.role_title;
  document.getElementById('match-role-exp-needed').textContent = `${jd.experience_years_required}+ yrs required (Detected: ${match.experience_detected} yrs)`;

  // Category Breakdown Table
  const catTableBody = document.getElementById('match-categories-table-body');
  if (catTableBody) {
    catTableBody.innerHTML = match.category_table.map(row => `
      <tr>
        <td style="font-weight: 500;">${row.category}</td>
        <td><strong>${row.score}%</strong></td>
        <td style="color: var(--text-muted);">${row.weight}</td>
        <td>
          <div class="progress-track" style="width: 140px;">
            <div class="progress-bar ${row.score >= 80 ? 'success' : (row.score >= 65 ? '' : 'warning')}" style="width: ${row.score}%"></div>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Matched Skills List with Evidence
  const matchedContainer = document.getElementById('match-matched-skills-list');
  if (matchedContainer) {
    matchedContainer.innerHTML = match.matched_skills.map(s => `
      <div style="background: var(--bg-card-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <span style="font-weight: 600; color: var(--success);">✓ ${s.name}</span>
          <span class="badge ${s.evidence_level === 'High' ? 'badge-success' : 'badge-neutral'}">${s.evidence_level} Evidence</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin: 0;">${s.evidence_label}</p>
        ${s.sample_evidence ? `<p style="font-size: 0.74rem; color: var(--text-muted); font-style: italic; margin-top: 0.25rem;">"${s.sample_evidence}"</p>` : ''}
      </div>
    `).join('') || '<p style="color: var(--text-muted);">No overlapping skills detected.</p>';
  }

  // Missing Skills List with Strategic Advice
  const missingContainer = document.getElementById('match-missing-skills-list');
  if (missingContainer) {
    missingContainer.innerHTML = match.missing_skills.map(s => `
      <div style="background: var(--bg-card-alt); border-left: 3px solid var(--warning); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 0.6rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <strong style="color: var(--warning); font-size: 0.9rem;">⚠ ${s.name}</strong>
          <span class="badge badge-warning">${s.importance}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; margin: 0;">${s.advice}</p>
      </div>
    `).join('') || '<p style="color: var(--success);">All target role requirements met!</p>';
  }

  // "Why This Score?" Explainability
  const strengthsContainer = document.getElementById('match-strengths-list');
  if (strengthsContainer) {
    strengthsContainer.innerHTML = match.strengths.map(s => `
      <li style="margin-bottom: 0.5rem; font-size: 0.86rem; color: var(--text-primary);">
        <strong style="color: var(--success);">+</strong> ${s}
      </li>
    `).join('');
  }

  const gapsContainer = document.getElementById('match-gaps-list');
  if (gapsContainer) {
    gapsContainer.innerHTML = match.gaps.map(g => `
      <li style="margin-bottom: 0.5rem; font-size: 0.86rem; color: var(--text-secondary);">
        <strong style="color: var(--danger);">–</strong> ${g}
      </li>
    `).join('');
  }

  // Also update Dashboard's Latest Job Match card
  document.getElementById('dash-job-role-title').textContent = jd.role_title;
  document.getElementById('dash-job-match-bar').style.width = `${match.overall_match}%`;
  document.getElementById('dash-job-match-pct').textContent = `${match.overall_match}%`;
  document.getElementById('dash-matched-count-text').textContent = `${match.matched_count} skills matched`;
  document.getElementById('dash-missing-count-text').textContent = `${match.missing_count} skills missing`;
}

/* ==========================================================================
   Skill Gap & Career Learning Path
   ========================================================================== */
function renderSkillGapResults(gapData) {
  if (!gapData) return;

  // Critical Gaps
  const critList = document.getElementById('gap-critical-list');
  if (critList) {
    critList.innerHTML = gapData.critical.map(s => `
      <div style="background: var(--bg-card-alt); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid var(--danger-border);">
        <strong style="color: var(--danger);">${s.name}</strong>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">${s.advice}</p>
      </div>
    `).join('') || '<p style="color: var(--text-muted); font-size: 0.84rem;">No critical gaps detected.</p>';
  }

  // Important Gaps
  const impList = document.getElementById('gap-important-list');
  if (impList) {
    impList.innerHTML = gapData.important.map(s => `
      <div style="background: var(--bg-card-alt); border-radius: var(--radius-md); padding: 0.75rem; margin-bottom: 0.5rem; border: 1px solid var(--warning-border);">
        <strong style="color: var(--warning);">${s.name}</strong>
        <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">${s.advice}</p>
      </div>
    `).join('') || '<p style="color: var(--text-muted); font-size: 0.84rem;">No important gaps detected.</p>';
  }

  // Learning Path Steps
  const roadmapContainer = document.getElementById('gap-roadmap-container');
  if (roadmapContainer) {
    const roadmap = gapData.roadmap || [];
    if (roadmap.length === 0) {
      roadmapContainer.innerHTML = '<p style="color: var(--text-muted);">Your resume aligns strongly with this role. No immediate up-skilling steps needed!</p>';
    } else {
      roadmapContainer.innerHTML = roadmap.map(step => `
        <div style="display: flex; gap: 1.25rem; margin-bottom: 1.2rem; align-items: flex-start;">
          <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--accent-gradient); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(59,130,246,0.3);">
            ${step.step}
          </div>
          <div style="flex: 1; background: var(--bg-card-alt); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <h5 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary);">${step.title}</h5>
              <span class="badge badge-info">⏱ ${step.time}</span>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.4rem;">${step.desc}</p>
            <span class="badge badge-neutral" style="font-size: 0.72rem;">Focus: ${step.skill}</span>
          </div>
        </div>
      `).join('');
    }
  }
}

/* ==========================================================================
   Section Diagnostics & Risk Detector
   ========================================================================== */
function renderSectionAnalyzer() {
  const container = document.getElementById('section-diagnostics-container');
  if (!container || !state.sectionDiagnostics) return;

  container.innerHTML = state.sectionDiagnostics.map(item => `
    <div class="card" style="margin-bottom: 1rem;">
      <div class="card-header">
        <div class="card-title">
          <span>${item.section}</span>
          <span class="badge ${item.status === 'Strong' ? 'badge-success' : (item.status === 'Needs Polish' ? 'badge-warning' : 'badge-danger')}">
            ${item.status}
          </span>
        </div>
        <strong style="font-size: 1.15rem; color: ${item.score >= 80 ? 'var(--success)' : 'var(--warning)'};">
          ${item.score}/100
        </strong>
      </div>
      <p style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5;">${item.feedback}</p>
    </div>
  `).join('');
}

function renderRiskDetector() {
  const container = document.getElementById('risk-detector-container');
  const countBadge = document.getElementById('risk-count-badge');
  if (!container) return;

  const risks = state.risks || [];
  if (countBadge) {
    countBadge.textContent = `${risks.length} Issues Detected`;
    countBadge.className = risks.length > 0 ? 'badge badge-warning' : 'badge badge-success';
  }

  if (risks.length === 0) {
    container.innerHTML = `
      <div style="background: var(--success-bg); border: 1px solid var(--success-border); border-radius: var(--radius-md); padding: 1.25rem; text-align: center;">
        <h4 style="color: var(--success); margin-bottom: 0.3rem;">✓ Clean Resume Health</h4>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">No critical red flags or ATS formatting risks detected.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = risks.map(r => `
    <div class="risk-card ${r.severity === 'Critical' ? '' : (r.severity === 'Important' ? 'warning-risk' : 'minor-risk')}">
      <div class="risk-header">
        <span class="risk-title">
          <span>${r.severity === 'Critical' ? '🚨' : '⚠'}</span>
          <span>${r.title}</span>
        </span>
        <span class="badge ${r.severity === 'Critical' ? 'badge-danger' : (r.severity === 'Important' ? 'badge-warning' : 'badge-info')}">
          ${r.severity}
        </span>
      </div>
      <p class="risk-detail">${r.detail}</p>
      <div class="risk-fix">
        <strong>Recommended Fix:</strong> ${r.fix}
      </div>
    </div>
  `).join('');
}

/* ==========================================================================
   Resume Improvement Assistant (Sentence Rewriter)
   ========================================================================== */
function populateRewriterPresets() {
  const select = document.getElementById('rewriter-preset-select');
  if (!select || !state.parsedResume) return;

  const allBullets = [
    ...(state.parsedResume.experience_bullets || []),
    ...(state.parsedResume.project_bullets || [])
  ];

  select.innerHTML = '<option value="">-- Or choose a bullet point from your resume --</option>' +
    allBullets.slice(0, 10).map((b, i) => `
      <option value="${escapeHtml(b)}">${b.substring(0, 85)}...</option>
    `).join('');

  select.addEventListener('change', (e) => {
    if (e.target.value) {
      document.getElementById('input-bullet-rewrite').value = e.target.value;
    }
  });
}

async function requestBulletRewrite(bullet) {
  const container = document.getElementById('rewriter-results-container');
  if (!container) return;

  container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem 0;">Transforming bullet with high-impact formula...</p>';

  try {
    const res = await fetch('/api/improve-bullet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bullet: bullet })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Rewrite failed');

    container.innerHTML = `
      <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-card-alt); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
        <span style="font-size: 0.76rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Original Sentence:</span>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">"${data.original}"</p>
      </div>

      <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--accent-primary);">
        ✨ High-Impact Professional Variations (Action + Tech + Scope + Result):
      </h4>

      ${data.variations.map((v, i) => `
        <div class="variation-card">
          <div class="variation-header">
            <span class="badge ${i === 0 ? 'badge-success' : 'badge-info'}">${v.label}</span>
            <button class="btn btn-sm btn-secondary" onclick="copyToClipboard('${escapeHtml(v.text)}')">
              📋 Copy
            </button>
          </div>
          <p class="variation-text">${v.text}</p>
          <div style="display: flex; gap: 1rem; margin-top: 0.6rem; font-size: 0.75rem; color: var(--text-muted);">
            <span><strong>Verb:</strong> ${v.action_verb}</span>
            <span><strong>Impact Metric:</strong> ${v.metric_highlight}</span>
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Error rewriting sentence: ${err.message}</p>`;
  }
}

/* ==========================================================================
   Multi-Job Comparison
   ========================================================================== */
async function runMultiJobComparison() {
  const container = document.getElementById('multijob-table-body');
  if (!container || !state.parsedResume) return;

  container.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Evaluating resume against all roles...</td></tr>';

  try {
    const res = await fetch('/api/compare-multiple-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parsed_resume: state.parsedResume,
        skills_info: state.skillsInfo
      })
    });
    const data = await res.json();

    container.innerHTML = data.comparison.map(job => `
      <tr>
        <td>
          <strong>${job.title}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${job.company} &bull; ${job.level}</div>
        </td>
        <td>
          <span style="font-size: 1.1rem; font-weight: 700; color: ${job.overall_match >= 75 ? 'var(--success)' : (job.overall_match >= 60 ? 'var(--accent-primary)' : 'var(--warning)')};">
            ${job.overall_match}%
          </span>
        </td>
        <td>${job.technical_match}%</td>
        <td>
          <span class="badge badge-success">✓ ${job.matched_count}</span>
        </td>
        <td>
          <span class="badge badge-warning">⚠ ${job.missing_count}</span>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">${job.key_gaps.join(', ') || 'None'}</div>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="switchAndMatchJob('${job.job_id}')">
            View Analysis →
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="color: var(--danger); padding: 1rem;">Error running comparison: ${err.message}</td></tr>`;
  }
}

function switchAndMatchJob(jobId) {
  const select = document.getElementById('match-role-select');
  if (select) {
    select.value = jobId;
  }
  switchTab('match');
  triggerJobMatch(jobId);
}

/* ==========================================================================
   Resume Evolution (v1 vs v2)
   ========================================================================== */
async function renderEvolutionView() {
  const container = document.getElementById('evolution-comparison-container');
  if (!container) return;

  const v1 = state.v1Snapshot || { version: 'v1', health_score: 68, skills: ['Python', 'SQL', 'Git'], measurable_bullets: 1, risks_count: 4 };
  const v2 = state.v2Snapshot || (state.healthData ? {
    version: 'v2',
    health_score: state.healthData.overall_health,
    skills: state.skillsInfo.skill_names,
    measurable_bullets: state.healthData.measurable_bullets_count,
    risks_count: state.risks.length
  } : { version: 'v2', health_score: 86, skills: ['Python', 'SQL', 'Docker', 'AWS', 'Git', 'React'], measurable_bullets: 4, risks_count: 0 });

  try {
    const res = await fetch('/api/compare-versions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ v1: v1, v2: v2 })
    });
    const data = await res.json();

    container.innerHTML = `
      <div class="grid-2" style="margin-bottom: 1.5rem;">
        <div class="card" style="text-align: center; border-color: var(--border-subtle);">
          <span class="badge badge-neutral" style="margin-bottom: 0.5rem;">Baseline: ${data.version_old}</span>
          <div style="font-size: 2.5rem; font-weight: 800; color: var(--text-secondary);">${data.score_old}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Initial Health & ATS Score</div>
        </div>

        <div class="card" style="text-align: center; border-color: var(--success-border); background: var(--bg-card);">
          <span class="badge badge-success" style="margin-bottom: 0.5rem;">Optimized: ${data.version_new}</span>
          <div style="font-size: 2.5rem; font-weight: 800; color: var(--success);">${data.score_new}</div>
          <div style="font-size: 0.8rem; color: var(--success);">
            <strong>${data.delta_score} Points</strong> Improvement!
          </div>
        </div>
      </div>

      <div class="card">
        <h4 style="font-size: 1rem; margin-bottom: 0.8rem; color: var(--accent-primary);">
          🚀 What Changed & Improved:
        </h4>
        <ul style="padding-left: 1.2rem; font-size: 0.88rem; line-height: 1.8;">
          ${data.improvements.map(imp => `<li>${imp}</li>`).join('')}
        </ul>

        ${data.added_skills.length > 0 ? `
          <div style="margin-top: 1rem;">
            <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Newly Added Technologies:</span>
            <div class="skill-pills" style="margin-top: 0.4rem;">
              ${data.added_skills.map(s => `<span class="badge badge-success">+ ${s}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">Error comparing versions: ${err.message}</p>`;
  }
}

/* ==========================================================================
   Application Tracker
   ========================================================================== */
async function loadApplications() {
  try {
    const res = await fetch('/api/applications');
    const apps = await res.json();
    state.applications = apps || [];
    renderApplicationTracker();
  } catch (err) {
    console.error('Error loading applications:', err);
  }
}

function renderApplicationTracker() {
  const container = document.getElementById('applications-table-body');
  if (!container) return;

  if (state.applications.length === 0) {
    container.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No job applications tracked yet.</td></tr>';
    return;
  }

  container.innerHTML = state.applications.map(app => `
    <tr>
      <td><strong>${app.company}</strong></td>
      <td>${app.role}</td>
      <td>
        <span class="badge ${app.match_score >= 80 ? 'badge-success' : 'badge-info'}">${app.match_score}%</span>
      </td>
      <td><span class="badge badge-neutral">${app.resume_version}</span></td>
      <td>
        <select onchange="updateAppStatus('${app.id}', this.value)" style="background: var(--bg-card-alt); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.8rem;">
          <option value="Saved" ${app.status === 'Saved' ? 'selected' : ''}>Saved</option>
          <option value="Applied" ${app.status === 'Applied' ? 'selected' : ''}>Applied</option>
          <option value="Interview" ${app.status === 'Interview' ? 'selected' : ''}>Interview</option>
          <option value="Offer" ${app.status === 'Offer' ? 'selected' : ''}>Offer</option>
          <option value="Closed" ${app.status === 'Closed' ? 'selected' : ''}>Closed</option>
        </select>
      </td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${app.date_added}</td>
      <td>
        <button class="btn btn-sm btn-icon-only" title="Delete application" onclick="deleteApplication('${app.id}')">✕</button>
      </td>
    </tr>
  `).join('');
}

async function updateAppStatus(appId, newStatus) {
  try {
    await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    loadApplications();
  } catch (err) {
    console.error('Error updating application status:', err);
  }
}

async function deleteApplication(appId) {
  try {
    await fetch(`/api/applications/${appId}`, { method: 'DELETE' });
    loadApplications();
  } catch (err) {
    console.error('Error deleting application:', err);
  }
}

async function trackCurrentMatch() {
  if (!state.currentMatch) {
    alert('Please run a job match first.');
    return;
  }

  const role = state.currentMatch.target_role || 'Software Engineer';
  const company = prompt('Enter Company Name:', 'Tech Company') || 'Target Company';

  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: company,
        role: role,
        match_score: state.currentMatch.overall_match,
        resume_version: 'v2',
        status: 'Saved',
        notes: `Matched with ${state.currentMatch.matched_count} skills and ${state.currentMatch.overall_match}% alignment.`
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Added ${company} (${role}) to Application Tracker!`);
      loadApplications();
      switchTab('tracker');
    }
  } catch (err) {
    alert('Failed to save to tracker: ' + err.message);
  }
}

/* ==========================================================================
   One-Click PDF Report Generation
   ========================================================================== */
async function triggerPdfDownload() {
  if (!state.parsedResume || !state.healthData || !state.currentMatch) {
    alert('Please ensure a resume and job match are loaded before generating report.');
    return;
  }

  const btn = document.getElementById('btn-download-pdf-report');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '⏳ Generating PDF...';
  btn.disabled = true;

  try {
    const payload = {
      candidate_name: state.parsedResume.contact.name || 'Candidate',
      target_role: state.currentMatch.target_role || 'Target Role',
      health: state.healthData,
      match: state.currentMatch,
      skill_gap: state.currentSkillGap
    };

    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to generate PDF');

    // Trigger browser download
    window.location.href = data.report_url;
  } catch (err) {
    alert('Failed to generate PDF report: ' + err.message);
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

/* ==========================================================================
   Utility Helpers
   ========================================================================== */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied improved bullet point to clipboard!');
  }).catch(() => {
    alert('Failed to copy. Please copy manually.');
  });
}

function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
