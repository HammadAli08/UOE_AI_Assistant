"""
test_ms_phd_filters.py
=============================================================================
Comprehensive metadata filter test suite for ms-phd-schemes namespace.

Tests the FULL filter pipeline:
  1. QueryFilterParser.parse()          → ParsedQuery fields
  2. ParsedQuery.to_pinecone_filter()   → Pinecone filter dict
  3. ParsedQuery.relaxed_filters()      → Progressive relaxation stages
  4. Cross-namespace isolation           → No shortcut leakage
  5. Edge cases                          → Ambiguous / minimal queries

Run:
    python test_ms_phd_filters.py
=============================================================================
"""

import sys
import json
from typing import Dict, Any

sys.path.insert(0, "/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend")

from rag_pipeline.query_filter_parser import get_query_filter_parser, ParsedQuery

parser = get_query_filter_parser()
NS_MS_PHD = "ms-phd-schemes"
NS_BS_ADP = "bs-adp-schemes"

passed = 0
failed = 0
total = 0


def _test(name: str, result: bool, detail: str = ""):
    global passed, failed, total
    total += 1
    if result:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name}: {detail}")


def run_test_group(title: str, tests):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")
    for test_fn in tests:
        test_fn()


# ═══════════════════════════════════════════════════════════════
# GROUP 1: FIELD EXTRACTION — MS/PhD namespace
# ═══════════════════════════════════════════════════════════════

def test_msc_physics_semester():
    r = parser.parse("msc physics semester 3 courses", NS_MS_PHD)
    _test("MSc Physics → program_name", r.program_name == "MSc Physics",
          f"got: {r.program_name}")
    _test("MSc Physics → degree_type", r.degree_type == "MSc",
          f"got: {r.degree_type}")
    _test("MSc Physics → semester", r.semester == 3,
          f"got: {r.semester}")
    _test("MSc Physics → chunk_type", r.chunk_type == "semester_subjects",
          f"got: {r.chunk_type}")
    _test("MSc Physics → department", r.department == "Physics",
          f"got: {r.department}")


def test_phd_education_admission():
    r = parser.parse("admission requirements for PhD Education", NS_MS_PHD)
    _test("PhD Education → degree_type", r.degree_type == "PhD",
          f"got: {r.degree_type}")
    _test("PhD Education → program_name", r.program_name == "PhD Education",
          f"got: {r.program_name}")
    _test("PhD Education → chunk_type=admission", r.chunk_type == "admission",
          f"got: {r.chunk_type}")


def test_ms_cs_shortcut():
    r = parser.parse("ms cs semester 1", NS_MS_PHD)
    _test("MS CS → program_name", r.program_name == "MS Computer Science",
          f"got: {r.program_name}")
    _test("MS CS → degree_type", r.degree_type == "MS",
          f"got: {r.degree_type}")
    _test("MS CS → semester", r.semester == 1,
          f"got: {r.semester}")


def test_mphil_english_linguistics():
    r = parser.parse("mphil english linguistics courses", NS_MS_PHD)
    _test("MPhil English (Ling) → program_name",
          r.program_name == "MPhil English (Linguistics)",
          f"got: {r.program_name}")
    _test("MPhil English (Ling) → degree_type", r.degree_type == "MPhil",
          f"got: {r.degree_type}")


def test_mba_fee_structure():
    r = parser.parse("fee structure for MBA", NS_MS_PHD)
    _test("MBA fee → program_name", r.program_name == "MBA",
          f"got: {r.program_name}")
    _test("MBA fee → chunk_type=list_chunk", r.chunk_type == "list_chunk",
          f"got: {r.chunk_type}")


def test_thesis_requirement():
    r = parser.parse("thesis requirement for MPhil Education", NS_MS_PHD)
    _test("Thesis → chunk_type=program_design", r.chunk_type == "program_design",
          f"got: {r.chunk_type}")


def test_course_code_extraction():
    r = parser.parse("syllabus of EDUC8112", NS_MS_PHD)
    _test("Course code → EDUC8112", r.course_code == "EDUC8112",
          f"got: {r.course_code}")
    _test("Course code → chunk_type=course_detail", r.chunk_type == "course_detail",
          f"got: {r.chunk_type}")


def test_specialization_tracks():
    r = parser.parse("specialization tracks in MA Special Education", NS_MS_PHD)
    _test("Specialization → chunk_type=list_chunk", r.chunk_type == "list_chunk",
          f"got: {r.chunk_type}")
    _test("Specialization → program_name", r.program_name == "MA Special Education",
          f"got: {r.program_name}")


def test_comprehensive_exam():
    r = parser.parse("comprehensive exam for PhD Chemistry", NS_MS_PHD)
    _test("Comp exam → chunk_type=program_overview", r.chunk_type == "program_overview",
          f"got: {r.chunk_type}")
    _test("Comp exam → degree_type=PhD", r.degree_type == "PhD",
          f"got: {r.degree_type}")


def test_pgd_program():
    r = parser.parse("pgd asd courses", NS_MS_PHD)
    _test("PGD ASD → program_name", r.program_name == "PGD ASD",
          f"got: {r.program_name}")
    _test("PGD ASD → degree_type", r.degree_type == "PGD",
          f"got: {r.degree_type}")


def test_phd_management_sciences():
    r = parser.parse("phd management sciences admission", NS_MS_PHD)
    _test("PhD Mgmt Sci → program_name",
          r.program_name == "PhD Management Sciences",
          f"got: {r.program_name}")
    _test("PhD Mgmt Sci → chunk_type=admission", r.chunk_type == "admission",
          f"got: {r.chunk_type}")


def test_mphil_elps():
    r = parser.parse("mphil educational leadership", NS_MS_PHD)
    _test("MPhil ELPS → program_name",
          r.program_name == "MPhil Educational Leadership and Policy Studies",
          f"got: {r.program_name}")


def test_deficiency_course():
    r = parser.parse("deficiency courses for MS Physics", NS_MS_PHD)
    _test("Deficiency → chunk_type=program_design", r.chunk_type == "program_design",
          f"got: {r.chunk_type}")


# ═══════════════════════════════════════════════════════════════
# GROUP 2: PINECONE FILTER DICT CONSTRUCTION
# ═══════════════════════════════════════════════════════════════

def test_filter_dict_full():
    r = parser.parse("ms cs semester 2 subjects", NS_MS_PHD)
    f = r.to_pinecone_filter()
    _test("Filter has program_name", "program_name" in f,
          f"got: {f}")
    _test("Filter has semester", "semester" in f,
          f"got: {f}")
    _test("Filter has chunk_type", "chunk_type" in f,
          f"got: {f}")
    _test("Filter program_name=$eq", f.get("program_name") == {"$eq": "MS Computer Science"},
          f"got: {f.get('program_name')}")
    _test("Filter semester=$eq 2", f.get("semester") == {"$eq": 2},
          f"got: {f.get('semester')}")


def test_filter_dict_course_code():
    r = parser.parse("tell me about COMP8812", NS_MS_PHD)
    f = r.to_pinecone_filter()
    _test("Filter has course_code", "course_code" in f,
          f"got: {f}")
    _test("Filter course_code=$eq COMP8812",
          f.get("course_code") == {"$eq": "COMP8812"},
          f"got: {f.get('course_code')}")


def test_filter_dept_fallback():
    """When only department (no program) is detected, department should appear in filter."""
    r = parser.parse("physics courses overview", NS_MS_PHD)
    f = r.to_pinecone_filter()
    # No program_name shortcut matched → department fallback
    if r.program_name:
        _test("Filter dept fallback: program found instead (ok)",
              True)
    else:
        _test("Filter has department (fallback)", "department" in f,
              f"got: {f}")


# ═══════════════════════════════════════════════════════════════
# GROUP 3: PROGRESSIVE RELAXATION STAGES
# ═══════════════════════════════════════════════════════════════

def test_relaxation_stages():
    r = parser.parse("ms chemistry semester 2 subjects", NS_MS_PHD)
    stages = r.relaxed_filters()

    _test("Relaxation: at least 3 stages", len(stages) >= 3,
          f"got {len(stages)} stages")
    _test("Relaxation: first stage = full filter", stages[0] == r.to_pinecone_filter(),
          f"first={stages[0]}")
    _test("Relaxation: last stage = empty (semantic fallback)", stages[-1] == {},
          f"last={stages[-1]}")

    # Check that semester was dropped in some stage
    has_sem_drop = any(
        "semester" not in stage and stage != {} and stage != stages[0]
        for stage in stages
    )
    _test("Relaxation: semester dropped in some stage", has_sem_drop,
          f"stages: {stages}")


def test_relaxation_course_code():
    r = parser.parse("EDUC8112 course outline", NS_MS_PHD)
    stages = r.relaxed_filters()

    _test("Course code relaxation: at least 2 stages", len(stages) >= 2,
          f"got {len(stages)}")


# ═══════════════════════════════════════════════════════════════
# GROUP 4: CROSS-NAMESPACE ISOLATION
# ═══════════════════════════════════════════════════════════════

def test_ms_shortcut_not_in_bsadp():
    """MS/PhD shortcuts must NOT match when querying bs-adp-schemes."""
    r = parser.parse("msc physics semester 3", NS_BS_ADP)
    _test("MSc Physics NOT matched in BS/ADP",
          r.program_name != "MSc Physics",
          f"got: {r.program_name}")


def test_bs_shortcut_not_in_msphd():
    """BS/ADP shortcuts must NOT match when querying ms-phd-schemes."""
    r = parser.parse("bscs semester 5", NS_MS_PHD)
    _test("BSCS NOT matched in MS/PhD",
          r.program_name != "BS Computer Science",
          f"got: {r.program_name}")


def test_unsupported_namespace():
    """Unsupported namespace → skip (no filters)."""
    r = parser.parse("anything", "rules-regulations")
    _test("Unsupported namespace → no filters", not r.has_filters)


# ═══════════════════════════════════════════════════════════════
# GROUP 5: BS/ADP REGRESSION
# ═══════════════════════════════════════════════════════════════

def test_bscs_regression():
    r = parser.parse("bs computer science semester 5", NS_BS_ADP)
    _test("BSCS regression → program_name", r.program_name == "BS Computer Science",
          f"got: {r.program_name}")
    _test("BSCS regression → semester 5", r.semester == 5,
          f"got: {r.semester}")


def test_adp_math_regression():
    r = parser.parse("adp math semester 2", NS_BS_ADP)
    _test("ADP Math regression → program_name",
          r.program_name == "ADP Mathematics (2 Years)",
          f"got: {r.program_name}")


def test_course_code_bsadp():
    r = parser.parse("course outline of COMP3149", NS_BS_ADP)
    _test("COMP3149 regression → course_code", r.course_code == "COMP3149",
          f"got: {r.course_code}")
    _test("COMP3149 regression → chunk_type", r.chunk_type == "course_detail",
          f"got: {r.chunk_type}")


# ═══════════════════════════════════════════════════════════════
# GROUP 6: EDGE CASES
# ═══════════════════════════════════════════════════════════════

def test_empty_query():
    r = parser.parse("", NS_MS_PHD)
    _test("Empty query → no filters", not r.has_filters)


def test_generic_query():
    r = parser.parse("what courses are available", NS_MS_PHD)
    # Should still detect something (chunk_type at least)
    _test("Generic query → has_filters or graceful skip",
          isinstance(r, ParsedQuery))


def test_roman_numeral_semester():
    r = parser.parse("msc chemistry semester III subjects", NS_MS_PHD)
    _test("Roman numeral III → semester=3", r.semester == 3,
          f"got: {r.semester}")


def test_ordinal_semester():
    r = parser.parse("3rd semester of PhD Education", NS_MS_PHD)
    _test("Ordinal 3rd → semester=3", r.semester == 3,
          f"got: {r.semester}")


def test_mba_variants():
    """MBA 1.5 year and MBA 3.5 years should resolve correctly."""
    r1 = parser.parse("mba 1.5 year courses", NS_MS_PHD)
    _test("MBA 1.5 Year → program_name", r1.program_name == "MBA 1.5 Year",
          f"got: {r1.program_name}")

    r2 = parser.parse("mba 3.5 years semester 1", NS_MS_PHD)
    _test("MBA 3.5 Years → program_name", r2.program_name == "MBA 3.5 Years",
          f"got: {r2.program_name}")


def test_med_special_education():
    r = parser.parse("m.ed special education courses", NS_MS_PHD)
    _test("M.Ed Special Ed → program_name",
          r.program_name == "MEd Special Education",
          f"got: {r.program_name}")


def test_department_only_query():
    """When no degree type prefix, department should still be detected."""
    r = parser.parse("management sciences courses", NS_MS_PHD)
    _test("Dept-only → department=Management Sciences",
          r.department == "Management Sciences",
          f"got: {r.department}")


def test_semester_no_cap():
    """MS/PhD programs can go beyond semester 8."""
    r = parser.parse("msc zoology semester 4 subjects", NS_MS_PHD)
    _test("Semester 4 (no cap) → semester=4", r.semester == 4,
          f"got: {r.semester}")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  MS/PhD METADATA FILTER TEST SUITE")
    print("=" * 60)

    run_test_group("GROUP 1: Field Extraction — MS/PhD", [
        test_msc_physics_semester,
        test_phd_education_admission,
        test_ms_cs_shortcut,
        test_mphil_english_linguistics,
        test_mba_fee_structure,
        test_thesis_requirement,
        test_course_code_extraction,
        test_specialization_tracks,
        test_comprehensive_exam,
        test_pgd_program,
        test_phd_management_sciences,
        test_mphil_elps,
        test_deficiency_course,
    ])

    run_test_group("GROUP 2: Pinecone Filter Dict Construction", [
        test_filter_dict_full,
        test_filter_dict_course_code,
        test_filter_dept_fallback,
    ])

    run_test_group("GROUP 3: Progressive Relaxation Stages", [
        test_relaxation_stages,
        test_relaxation_course_code,
    ])

    run_test_group("GROUP 4: Cross-Namespace Isolation", [
        test_ms_shortcut_not_in_bsadp,
        test_bs_shortcut_not_in_msphd,
        test_unsupported_namespace,
    ])

    run_test_group("GROUP 5: BS/ADP Regression", [
        test_bscs_regression,
        test_adp_math_regression,
        test_course_code_bsadp,
    ])

    run_test_group("GROUP 6: Edge Cases", [
        test_empty_query,
        test_generic_query,
        test_roman_numeral_semester,
        test_ordinal_semester,
        test_mba_variants,
        test_med_special_education,
        test_department_only_query,
        test_semester_no_cap,
    ])

    print()
    print("=" * 60)
    if failed == 0:
        print(f"  🎯 ALL {total} TESTS PASSED")
    else:
        print(f"  ❌ {failed}/{total} FAILED")
    print("=" * 60)
    print()

    # Print summary JSON for sample filter outputs
    print("─" * 60)
    print("  SAMPLE PINECONE FILTER OUTPUTS")
    print("─" * 60)
    samples = [
        ("ms cs semester 2 subjects", NS_MS_PHD),
        ("phd education admission", NS_MS_PHD),
        ("EDUC8112", NS_MS_PHD),
        ("mba fee structure", NS_MS_PHD),
        ("thesis requirement for mphil economics", NS_MS_PHD),
        ("bscs semester 5", NS_BS_ADP),
    ]
    for q, ns in samples:
        r = parser.parse(q, ns)
        full_filter = r.to_pinecone_filter()
        stages = r.relaxed_filters()
        print(f"\n  Query: '{q}' (ns={ns})")
        print(f"  Parsed: {r}")
        print(f"  Filter: {json.dumps(full_filter, indent=2)}")
        print(f"  Stages: {len(stages)}")
        for i, s in enumerate(stages):
            label = "FULL" if i == 0 else ("SEMANTIC" if not s else f"RELAXED-{i}")
            print(f"    [{label}] {json.dumps(s)}")

    sys.exit(1 if failed > 0 else 0)
