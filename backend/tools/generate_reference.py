"""Extract versioned methodology data from the user-supplied DOCX and XLSX.

Run with explicit source paths. Generated JSON is committed; runtime does not need
Office files or openpyxl. Text formulas are preserved for audit and review.
"""
from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from openpyxl import load_workbook


def document_lines(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    return [
        text
        for paragraph in root.findall(".//w:p", namespace)
        if (text := "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace)).strip())
    ]


def methodology(path: Path) -> dict:
    lines = document_lines(path)
    starts = [i for i, line in enumerate(lines) if re.match(r"^L[12]-\d{2}\s*[:|]", line)]
    entries = []
    for start, end in zip(starts, starts[1:] + [len(lines)]):
        block = lines[start:end]
        code = re.match(r"^(L[12]-\d{2})", block[0]).group(1)
        # Only the first parameter table belongs to the relationship; the
        # expanded L1-01 worked example also contains additional tables.
        header = next((i for i in range(len(block) - 3) if block[i:i+4] == ["Parameter", "Weight", "Formula", "Rating thresholds"]), None)
        if header is None:
            raise ValueError(f"Parameter table missing for {code}")
        parameters = []
        for offset in (header + 4, header + 8, header + 12):
            name, weight, formula, thresholds = block[offset:offset+4]
            if not re.fullmatch(r"\d+%", weight):
                raise ValueError(f"Unexpected weight in {code}: {weight}")
            parameters.append({"name": name, "weight": int(weight[:-1]) / 100, "formula_text": formula, "rating_thresholds_text": thresholds})
        if round(sum(p["weight"] for p in parameters), 6) != 1:
            raise ValueError(f"Weights do not total 100% for {code}")
        entries.append({"code": code, "parameters": parameters, "source": path.name})
    if len(entries) != 25:
        raise ValueError(f"Expected 25 scored relationships; found {len(entries)}")
    return {"version": "1.1.0", "status": "published", "approver": "Methodology document", "effective_date": "2026-08-31", "relationships": entries,
            "stress_weights": {"financial_liquidity": 0.4, "credit_market": 0.35, "operational_legal_reputation": 0.25},
            "confidence_weights": {"source_quality": 0.5, "data_freshness": 0.3, "verification_status": 0.2},
            "final_weights": {"standalone": 0.45, "network": 0.35, "concentration": 0.1, "event": 0.1},
            "connectivity_weights": {"direct": 0.4, "indirect": 0.3, "diversity": 0.3},
            "contagion_weights": {"exposure_concentration": 0.35, "connectivity": 0.35, "connected_stress": 0.3},
            "committee_weights": {"final": 0.4, "contagion": 0.3, "concentration": 0.2, "event": 0.1},
            "scenario_severity_weights": {"trigger_stress": 0.4, "connectivity": 0.35, "contagion": 0.25},
            "early_warning": {"turnover_decline_thresholds": [10, 20, 35],
                              "sector_stress_weights": {"industry_default_rate": 0.5, "rating_downgrades": 0.3, "market_indicators": 0.2},
                              "sector_stress_thresholds": [25, 50, 75]},
            "network_formula": "100 * (1 - product(1 - contribution_i / 100))",
            "final_formula": "0.45 * standalone + 0.35 * network + 0.10 * concentration + 0.10 * event",
            "relationship_bands": [[0, "Weak"], [20, "Moderate"], [40, "Material"], [60, "Strong"], [80, "Critical"]],
            "final_bands": [[0, "Low"], [20, "Moderate"], [40, "Elevated"], [60, "High"], [80, "Critical"]],
            "direction_factors": {"direct": 1.0, "strong_indirect": 0.75, "moderate_indirect": 0.5, "weak_ancillary": 0.25},
            "exposure_factors": [[0, 0.75], [10, 0.9], [25, 1.0], [50, 1.1], [75, 1.25]],
            "scenario_material_threshold": 25, "main_graph_depth": 2}


def taxonomy(path: Path) -> dict:
    workbook = load_workbook(path, read_only=True, data_only=True)
    sheet = workbook["Relationships"]
    headers = list(sheet.values)[1]
    entries = []
    for row in list(sheet.values)[2:]:
        if isinstance(row[1], str) and re.fullmatch(r"(?:L[12]|A)-\d{2}", row[1]):
            entries.append({str(header): value for header, value in zip(headers, row) if header and value is not None})
    sources = []
    source_sheet = workbook["Source Catalogue"]
    source_headers = list(source_sheet.values)[2]
    for row in list(source_sheet.values)[3:]:
        if row[0]:
            sources.append({str(header): value for header, value in zip(source_headers, row) if header and value is not None})
    if len(entries) != 45:
        raise ValueError(f"Expected 45 taxonomy entries; found {len(entries)}")
    return {"version": "0.1", "source": path.name, "relationships": entries, "sources": sources}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    parser.add_argument("xlsx", type=Path)
    args = parser.parse_args()
    destination = Path(__file__).resolve().parents[1] / "app" / "configuration"
    destination.mkdir(parents=True, exist_ok=True)
    for name, data in (("methodology_v1.json", methodology(args.docx)), ("taxonomy_v0_1.json", taxonomy(args.xlsx))):
        (destination / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(name, len(data["relationships"]), "relationships")
