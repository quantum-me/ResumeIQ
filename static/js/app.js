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
  v2Snapshot: null,
  currentVersion: null,
  versions: []
};

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  loadSampleResumes();
  loadStandardJobs();
  loadApplications();
  loadVersionHistory();
  
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

  // If switching to multi-job, evolution, or report, refresh them
  if (tabId === 'multijob' && state.parsedResume) {
    runMultiJobComparison();
  } else if (tabId === 'evolution') {
    renderEvolutionView();
  } else if (tabId === 'report') {
    if (state.currentVersion) {
      displayVersionQr(state.currentVersion.id);
    } else if (state.versions && state.versions.length > 0) {
      displayVersionQr(state.versions[0].id);
    }
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
   Resume Version Evolution & QR Sharing Controllers
   ========================================================================== */

async function loadVersionHistory() {
  const container = document.getElementById('version-history-table-body');
  try {
    const res = await fetch('/api/versions');
    const versions = await res.json();
    state.versions = versions || [];

    if (container) {
      if (state.versions.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No saved versions yet.</td></tr>';
      } else {
        container.innerHTML = state.versions.map(v => {
          const isShareable = v.share_status === 'Shareable';
          return `
            <tr>
              <td>
                <span class="badge ${v.version_code === 'v02' ? 'badge-info' : 'badge-neutral'}" style="font-weight: 700;">
                  ${v.version_number}
                </span>
              </td>
              <td style="color: var(--text-secondary); font-size: 0.82rem;">${v.date_display || v.created_at}</td>
              <td>
                <span style="font-size: 1.05rem; font-weight: 800; color: var(--accent-primary);">${v.health_score}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">/100</span>
              </td>
              <td>
                <span style="font-size: 1.05rem; font-weight: 800; color: var(--success);">${v.match_score}%</span>
              </td>
              <td>
                <span class="badge ${isShareable ? 'badge-success' : 'badge-warning'}">
                  ${isShareable ? '✓ Shareable' : '🔒 Private'}
                </span>
              </td>
              <td style="max-width: 280px; font-size: 0.8rem; color: var(--text-secondary);">
                ${escapeHtml(v.changes_summary || 'Resume analysis baseline snapshot.')}
              </td>
              <td>
                <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                  <button class="btn btn-sm btn-secondary" onclick="openVersionSnapshot('${v.id}')" title="Load this version snapshot into dashboard">
                    Open
                  </button>
                  <button class="btn btn-sm btn-primary" onclick="displayVersionQr('${v.id}', true)" title="View QR Card">
                    QR Card
                  </button>
                  <button class="btn btn-sm" style="background: ${isShareable ? 'var(--danger-bg)' : 'var(--bg-card-alt)'}; color: ${isShareable ? 'var(--danger)' : 'var(--text-secondary)'}; border: 1px solid var(--border-subtle);" onclick="quickToggleVersionPrivacy('${v.id}', '${v.share_status}')">
                    ${isShareable ? 'Revoke' : 'Share'}
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Populate comparison dropdowns
    populateVersionDiffDropdowns();

    // If currentVersion is null or needs initialization, pick newest
    if (!state.currentVersion && state.versions.length > 0) {
      state.currentVersion = state.versions[0];
      displayVersionQr(state.currentVersion.id, false);
    }
  } catch (err) {
    console.error('Error loading versions:', err);
    if (container) {
      container.innerHTML = `<tr><td colspan="7" style="color: var(--danger); padding: 1rem;">Failed to load versions: ${err.message}</td></tr>`;
    }
  }
}

function populateVersionDiffDropdowns() {
  const oldSelect = document.getElementById('diff-version-old-select');
  const newSelect = document.getElementById('diff-version-new-select');
  if (!oldSelect || !newSelect || state.versions.length === 0) return;

  const currentOld = oldSelect.value;
  const currentNew = newSelect.value;

  const opts = state.versions.map(v => 
    `<option value="${v.id}">${v.version_number} (${v.health_score} pts &bull; ${v.date_display})</option>`
  ).join('');

  oldSelect.innerHTML = opts;
  newSelect.innerHTML = opts;

  // Set default: newest vs second newest if available
  if (state.versions.length >= 2) {
    newSelect.value = currentNew || state.versions[0].id;
    oldSelect.value = currentOld || state.versions[1].id;
  } else if (state.versions.length === 1) {
    newSelect.value = state.versions[0].id;
    oldSelect.value = state.versions[0].id;
  }

  // Trigger diff comparison automatically
  triggerVersionsDiff();
}

async function triggerVersionsDiff() {
  const container = document.getElementById('what-changed-diff-container');
  const oldSelect = document.getElementById('diff-version-old-select');
  const newSelect = document.getElementById('diff-version-new-select');
  if (!container) return;

  const oldId = oldSelect ? oldSelect.value : null;
  const newId = newSelect ? newSelect.value : null;

  try {
    const res = await fetch('/api/versions/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_old_id: oldId, version_new_id: newId })
    });
    const diff = await res.json();
    if (!res.ok) throw new Error(diff.error || 'Failed to compare');

    const isScoreUp = diff.score_delta_raw >= 0;
    container.innerHTML = `
      <!-- Score & Match Delta Banner -->
      <div class="diff-banner">
        <div>
          <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Comparative Revisions</span>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-top: 0.2rem;">
            ${escapeHtml(diff.version_old)} &rarr; ${escapeHtml(diff.version_new)}
          </div>
        </div>

        <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Score Change</div>
            <div class="diff-delta-tag" style="color: ${isScoreUp ? 'var(--success)' : 'var(--danger)'};">
              ${diff.score_old} &rarr; ${diff.score_new} (${diff.score_delta_formatted})
            </div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Job Match Delta</div>
            <div class="diff-delta-tag" style="color: var(--accent-primary);">
              ${diff.match_old}% &rarr; ${diff.match_new}% (${diff.match_delta_formatted})
            </div>
          </div>
        </div>
      </div>

      <!-- Factual What Changed Grid -->
      <div class="diff-grid">
        <!-- What Improved Column -->
        <div class="diff-card">
          <div class="diff-card-title" style="color: var(--success);">
            <span>🚀</span> Factual Improvements Detected:
          </div>
          <ul style="padding-left: 1.2rem; font-size: 0.86rem; line-height: 1.8; color: var(--text-primary);">
            ${diff.what_improved.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>

          ${diff.newly_detected_skills && diff.newly_detected_skills.length > 0 ? `
            <div style="margin-top: 1rem; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">
                Newly Detected Technologies (${diff.newly_detected_skills.length}):
              </span>
              <div class="skill-pills" style="margin-top: 0.4rem;">
                ${diff.newly_detected_skills.map(s => `<span class="badge badge-success">+ ${escapeHtml(s)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Still Missing Column -->
        <div class="diff-card">
          <div class="diff-card-title" style="color: var(--warning);">
            <span>⚠</span> Still Missing / Skill Deficits:
          </div>
          ${diff.still_missing && diff.still_missing.length > 0 ? `
            <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
              Target role qualifications still absent from resume evidence:
            </p>
            <div class="skill-pills" style="margin-bottom: 1rem;">
              ${diff.still_missing.map(g => `<span class="badge badge-warning" style="background: var(--warning-bg); border-color: var(--warning-border); color: var(--warning);">⚠ ${escapeHtml(g)}</span>`).join('')}
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
              Tip: Add relevant projects, certifications, or bullet metrics demonstrating hands-on experience with these tools to reach 90%+ match.
            </p>
          ` : `
            <p style="font-size: 0.86rem; color: var(--success); padding: 0.5rem 0;">
              ✓ No critical skill deficits detected for this role benchmark!
            </p>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger); padding: 1rem;">Diff calculation error: ${err.message}</p>`;
  }
}

async function displayVersionQr(versionId, shouldSwitchTab = false) {
  let v = state.versions.find(x => x.id === versionId);
  if (!v) {
    try {
      const res = await fetch(`/api/versions/${versionId}`);
      v = await res.json();
    } catch (err) {
      console.error('Error fetching version:', err);
      return;
    }
  }
  if (!v) return;

  state.currentVersion = v;

  // Header badges
  const headerBadge = document.getElementById('qr-header-version-badge');
  if (headerBadge) headerBadge.textContent = v.version_number;

  const statusBadge = document.getElementById('qr-status-badge');
  const isShareable = v.share_status === 'Shareable';
  if (statusBadge) {
    statusBadge.className = isShareable ? 'badge badge-success' : 'badge badge-warning';
    statusBadge.textContent = isShareable ? '✓ Shareable' : '🔒 Private / Revoked';
  }

  // Version indicator & Role
  const roleEl = document.getElementById('qr-target-role-title');
  if (roleEl) roleEl.textContent = v.target_role || 'Software Engineer';

  const dateEl = document.getElementById('qr-analysis-date-text');
  if (dateEl) dateEl.textContent = `📅 Analyzed on ${v.date_display || v.created_at}`;

  const verInd = document.getElementById('qr-version-indicator');
  if (verInd) verInd.textContent = v.version_number;

  // Scores
  const healthEl = document.getElementById('qr-health-score-val');
  if (healthEl) healthEl.textContent = v.health_score;

  const matchEl = document.getElementById('qr-match-score-val');
  if (matchEl) matchEl.textContent = `${v.match_score}%`;

  // Fetch or generate QR code
  try {
    const qrRes = await fetch(`/api/versions/${v.id}/generate-qr`, { method: 'POST' });
    const qrData = await qrRes.json();
    if (qrRes.ok) {
      const img = document.getElementById('qr-image-display');
      if (img) img.src = qrData.qr_data_url;

      const input = document.getElementById('qr-share-url-input');
      if (input) input.value = qrData.share_url;

      const openLink = document.getElementById('qr-open-public-link');
      if (openLink) openLink.href = qrData.share_url;
    }
  } catch (err) {
    console.error('Error loading QR image:', err);
  }

  // Privacy status text
  const privacyText = document.getElementById('qr-privacy-status-text');
  if (privacyText) {
    privacyText.textContent = isShareable ? 'Status: Publicly Shareable (Safe - Contact info hidden)' : 'Status: Private / Access Revoked';
    privacyText.style.color = isShareable ? 'var(--success)' : 'var(--warning)';
  }

  // Toggle button text
  const toggleBtn = document.getElementById('btn-toggle-privacy');
  if (toggleBtn) {
    toggleBtn.textContent = isShareable ? '🔒 Make Private' : '🌐 Make Shareable';
  }

  if (shouldSwitchTab) {
    switchTab('report');
    const target = document.getElementById('qr-section-container');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

async function generateShareQr() {
  if (!state.parsedResume || !state.healthData) {
    alert('Please upload or load a resume analysis before generating a version snapshot.');
    return;
  }

  const btn = document.getElementById('btn-generate-share-qr');
  const origText = btn ? btn.innerHTML : '⚡ Generate Share QR';
  if (btn) {
    btn.innerHTML = '⏳ Generating QR...';
    btn.disabled = true;
  }

  try {
    const payload = {
      parsed_resume: state.parsedResume,
      skills_info: state.skillsInfo,
      health: state.healthData,
      match: state.currentMatch,
      skill_gap: state.currentSkillGap,
      target_role: state.currentMatch ? state.currentMatch.target_role : 'Software Engineer',
      filename: state.parsedResume.filename || 'Alex_Rivera_Optimized.pdf'
    };

    const res = await fetch('/api/versions/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save version');

    state.currentVersion = data.version;
    await loadVersionHistory();
    await displayVersionQr(data.version.id, false);

    alert(`🎉 Successfully generated Share QR for ${data.version.version_number}!\nShare URL: ${data.share_url}`);
  } catch (err) {
    alert('Error generating share QR: ' + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  }
}

async function saveCurrentAsNewVersion() {
  await generateShareQr();
}

function copyShareLink() {
  const input = document.getElementById('qr-share-url-input');
  if (!input || !input.value) {
    alert('No share link available yet.');
    return;
  }

  navigator.clipboard.writeText(input.value).then(() => {
    alert('✅ Copied verified ResumeIQ share link to clipboard!\n\n' + input.value);
  }).catch(() => {
    input.select();
    document.execCommand('copy');
    alert('✅ Copied share link to clipboard!');
  });
}

function downloadQrPng() {
  if (!state.currentVersion) {
    alert('Please generate or select a version first.');
    return;
  }
  const shareId = state.currentVersion.share_id;
  const a = document.createElement('a');
  a.href = `/api/qr/${shareId}.png`;
  a.download = `ResumeIQ_QR_${state.currentVersion.version_code || 'v'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function shareViaWebApi() {
  const shareUrl = document.getElementById('qr-share-url-input')?.value;
  if (!shareUrl) {
    alert('No share link generated yet.');
    return;
  }

  if (navigator.share && state.currentVersion) {
    navigator.share({
      title: `ResumeIQ - ${state.currentVersion.version_number} Analysis`,
      text: `View verified ResumeIQ resume analysis: Health Score ${state.currentVersion.health_score}/100, Job Match ${state.currentVersion.match_score}%`,
      url: shareUrl
    }).catch(e => {
      console.log('Share dismissed:', e);
    });
  } else {
    copyShareLink();
  }
}

async function toggleCurrentPrivacy() {
  if (!state.currentVersion) return;
  const currentStatus = state.currentVersion.share_status;
  const newStatus = currentStatus === 'Shareable' ? 'Private' : 'Shareable';

  try {
    const res = await fetch(`/api/versions/${state.currentVersion.id}/privacy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update privacy');

    state.currentVersion = data.version;
    await loadVersionHistory();
    await displayVersionQr(data.version.id, false);
    alert(`Updated privacy for ${data.version.version_number} to "${newStatus}".`);
  } catch (err) {
    alert('Error toggling privacy: ' + err.message);
  }
}

async function revokeCurrentAccess() {
  if (!state.currentVersion) return;
  if (!confirm(`Are you sure you want to revoke public access for ${state.currentVersion.version_number}? The link and QR code will immediately be disabled.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/versions/${state.currentVersion.id}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to revoke access');

    state.currentVersion = data.version;
    await loadVersionHistory();
    await displayVersionQr(data.version.id, false);
    alert(`🔒 Access revoked! Public share page and QR code for ${data.version.version_number} are now disabled.`);
  } catch (err) {
    alert('Error revoking access: ' + err.message);
  }
}

async function regenerateCurrentQr() {
  if (!state.currentVersion) return;
  if (!confirm(`Regenerate QR code for ${state.currentVersion.version_number}? This will permanently invalidate previous QR codes and links, issuing a brand new secure access key.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/versions/${state.currentVersion.id}/regenerate-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to regenerate QR');

    state.currentVersion = data.version;
    await loadVersionHistory();
    await displayVersionQr(data.version.id, false);
    alert(`🔄 Fresh QR Code Generated!\nPrevious QR codes and links are now permanently invalidated.\nNew Share URL: ${data.share_url}`);
  } catch (err) {
    alert('Error regenerating QR: ' + err.message);
  }
}

async function quickToggleVersionPrivacy(versionId, currentStatus) {
  const newStatus = currentStatus === 'Shareable' ? 'Private' : 'Shareable';
  try {
    const res = await fetch(`/api/versions/${versionId}/privacy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      await loadVersionHistory();
      if (state.currentVersion && state.currentVersion.id === versionId) {
        await displayVersionQr(versionId, false);
      }
    }
  } catch (err) {
    console.error('Error in quickToggleVersionPrivacy:', err);
  }
}

function openVersionSnapshot(versionId) {
  const v = state.versions.find(x => x.id === versionId);
  if (!v) return;

  // Load snapshot values to dashboard
  document.getElementById('dash-candidate-name').textContent = v.candidate_name || 'Candidate';
  document.getElementById('dash-contact-summary').textContent = `${v.contact?.email || 'Protected'} • ${v.contact?.phone || 'Protected'}`;
  document.getElementById('dash-health-number').textContent = v.health_score;
  setCircleGauge('dash-health-gauge', v.health_score);

  const roleEl = document.getElementById('dash-job-role-title');
  if (roleEl) roleEl.textContent = v.target_role;

  const matchPct = document.getElementById('dash-job-match-pct');
  if (matchPct) matchPct.textContent = `${v.match_score}%`;

  const matchBar = document.getElementById('dash-job-match-bar');
  if (matchBar) matchBar.style.width = `${v.match_score}%`;

  // Switch to dashboard and notify
  switchTab('dashboard');
  alert(`📂 Loaded snapshot of ${v.version_number} (${v.date_display}). Health: ${v.health_score}/100, Match: ${v.match_score}%.`);
}

function renderEvolutionView() {
  loadVersionHistory();
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
