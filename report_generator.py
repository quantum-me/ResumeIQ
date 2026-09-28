"""
report_generator.py - Professional PDF Report Generation via ReportLab
Generates an executive-ready Career Intelligence & Match Diagnostic PDF report.
"""

import os
from datetime import datetime
from typing import Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)


def generate_pdf_report(
    candidate_name: str,
    target_role: str,
    health_data: Dict[str, Any],
    match_data: Dict[str, Any],
    skill_gap_data: Dict[str, Any],
    output_path: str
) -> str:
    """
    Generates a high-quality multi-section executive PDF report.
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#0f172a") # Slate 900
    brand_blue = colors.HexColor("#3b82f6")    # Indigo / Blue
    accent_green = colors.HexColor("#10b981")  # Emerald 500
    text_muted = colors.HexColor("#64748b")    # Slate 500
    bg_light = colors.HexColor("#f8fafc")      # Slate 50

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=primary_color
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=text_muted
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=primary_color,
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )

    body_bold = ParagraphStyle(
        'BodyBold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    badge_pass = ParagraphStyle(
        'BadgePass',
        parent=body_style,
        fontName='Helvetica-Bold',
        fontSize=8,
        textColor=colors.HexColor("#065f46")
    )

    badge_gap = ParagraphStyle(
        'BadgeGap',
        parent=body_style,
        fontName='Helvetica-Bold',
        fontSize=8,
        textColor=colors.HexColor("#991b1b")
    )

    story = []

    # 1. Header Banner
    date_str = datetime.now().strftime("%B %d, %Y")
    header_table_data = [
        [
            Paragraph("<b>ResumeIQ</b> &nbsp;|&nbsp; Career Intelligence Platform", title_style),
            Paragraph(f"<b>Report Generated:</b><br/>{date_str}", subtitle_style)
        ],
        [
            Paragraph(f"Candidate: <b>{candidate_name}</b> &bull; Target Role: <b>{target_role}</b>", subtitle_style),
            Paragraph("Confidential Diagnostic", subtitle_style)
        ]
    ]
    header_table = Table(header_table_data, colWidths=[380, 150])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_blue, spaceBefore=4, spaceAfter=14))

    # 2. Executive Scorecards Table
    overall_health = health_data.get("overall_health", 82)
    overall_match = match_data.get("overall_match", 78)

    score_cards = [
        [
            Paragraph(f"<b>Overall Resume Health</b><br/><font size='18' color='#3b82f6'><b>{overall_health}/100</b></font><br/>Industry Benchmark: 75", body_style),
            Paragraph(f"<b>Job Description Alignment</b><br/><font size='18' color='#10b981'><b>{overall_match}%</b></font><br/>Strong Candidate Fit", body_style),
            Paragraph(f"<b>Matched Skills</b><br/><font size='18' color='#0f172a'><b>{match_data.get('matched_count', 0)}</b></font><br/>Verified Competencies", body_style),
            Paragraph(f"<b>Critical Gaps</b><br/><font size='18' color='#ef4444'><b>{match_data.get('missing_count', 0)}</b></font><br/>Targeted Up-skill Areas", body_style)
        ]
    ]
    score_table = Table(score_cards, colWidths=[130, 135, 135, 130])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 14))

    # 3. Match Engine Category Breakdown
    story.append(Paragraph("1. Match Engine Diagnostic Breakdown", h2_style))
    category_table_data = [
        [Paragraph("<b>Evaluation Category</b>", body_bold), Paragraph("<b>Score</b>", body_bold), Paragraph("<b>Weight</b>", body_bold), Paragraph("<b>Status Assessment</b>", body_bold)]
    ]
    cat_items = match_data.get("category_table", [])
    for item in cat_items:
        s = item.get("score", 75)
        status_text = "Exceptional" if s >= 85 else ("Aligned" if s >= 70 else "Action Required")
        category_table_data.append([
            Paragraph(item.get("category", ""), body_style),
            Paragraph(f"<b>{s}%</b>", body_style),
            Paragraph(str(item.get("weight", "20%")), body_style),
            Paragraph(status_text, body_style)
        ])

    cat_table = Table(category_table_data, colWidths=[180, 80, 80, 190])
    cat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(cat_table)
    story.append(Spacer(1, 12))

    # 4. Matched vs Missing Skills
    story.append(Paragraph("2. Skill Verification & Gap Analysis", h2_style))
    
    # Show matched
    matched_skills = match_data.get("matched_skills", [])
    matched_str = ", ".join([f"{m['name']} ({m.get('evidence_level', 'Basic')})" for m in matched_skills[:12]])
    story.append(Paragraph(f"<b>Matched Competencies ({len(matched_skills)}):</b>", body_bold))
    story.append(Paragraph(f"<font color='#065f46'>{matched_str or 'None detected'}</font>", body_style))
    story.append(Spacer(1, 6))

    # Show missing with context
    missing_skills = match_data.get("missing_skills", [])
    story.append(Paragraph(f"<b>Identified Skill Gaps ({len(missing_skills)}):</b>", body_bold))
    gap_table_data = [
        [Paragraph("<b>Skill</b>", body_bold), Paragraph("<b>Priority</b>", body_bold), Paragraph("<b>Strategic Recommendation</b>", body_bold)]
    ]
    for m in missing_skills[:5]:
        gap_table_data.append([
            Paragraph(m.get("name", ""), body_bold),
            Paragraph(m.get("importance", "Important"), badge_gap),
            Paragraph(m.get("advice", ""), body_style)
        ])
    
    if len(gap_table_data) > 1:
        gap_table = Table(gap_table_data, colWidths=[90, 70, 370])
        gap_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#fee2e2")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#fca5a5")),
        ]))
        story.append(gap_table)
    else:
        story.append(Paragraph("No significant skill deficiencies detected for this role profile.", body_style))

    story.append(Spacer(1, 12))

    # 5. Suggested Learning Path
    roadmap = skill_gap_data.get("roadmap", [])
    if roadmap:
        story.append(Paragraph("3. Recommended Career Learning Path", h2_style))
        road_table_data = [
            [Paragraph("<b>Step</b>", body_bold), Paragraph("<b>Skill Focus</b>", body_bold), Paragraph("<b>Learning Milestone</b>", body_bold), Paragraph("<b>Est. Time</b>", body_bold)]
        ]
        for step in roadmap[:4]:
            road_table_data.append([
                Paragraph(f"Step {step['step']}", body_bold),
                Paragraph(step["skill"], body_style),
                Paragraph(f"<b>{step['title']}</b>: {step['desc']}", body_style),
                Paragraph(step.get("time", "6 hrs"), body_style)
            ])
        road_table = Table(road_table_data, colWidths=[55, 85, 310, 80])
        road_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ]))
        story.append(road_table)
        story.append(Spacer(1, 12))

    # 6. Strengths & Gaps (Explainability)
    story.append(Paragraph("4. Explainability & Transparent Rationale", h2_style))
    strengths = match_data.get("strengths", [])
    gaps = match_data.get("gaps", [])

    for s in strengths[:3]:
        story.append(Paragraph(f"&bull; <b>Strength:</b> {s}", body_style))
    for g in gaps[:3]:
        story.append(Paragraph(f"&bull; <b>Area to Address:</b> {g}", body_style))

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#cbd5e1"), spaceBefore=4, spaceAfter=8))
    story.append(Paragraph("ResumeIQ Intelligence Engine &bull; Generated dynamically for professional career optimization.", subtitle_style))

    doc.build(story)
    return output_path
