from __future__ import annotations

from app.models import SourceRecord


def assess_record(record: SourceRecord) -> dict:
    issues = []
    if not record.legal_name.strip():
        issues.append("missing_legal_name")
    if not record.lei and not (record.registration_number and record.country):
        issues.append("no_cross_source_identifier")
    if record.classification == "RESTRICTED":
        issues.append("restricted_record_requires_steward_approval")
    return {"accepted": "missing_legal_name" not in issues and "restricted_record_requires_steward_approval" not in issues,
            "issues": issues, "quality_score": max(0, 100 - 30 * len(issues))}
