"""
Test suite for QueryFilterParser — validates rule-based metadata extraction.

Usage:
    python test_filter_parser.py          # Run all tests
    python test_filter_parser.py --live   # Also run live Pinecone queries
"""

import sys
import json
import logging
from pathlib import Path

# Ensure backend is importable
sys.path.insert(0, str(Path(__file__).parent))

from rag_pipeline.query_filter_parser import QueryFilterParser, ParsedQuery

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# TEST CASES: (query, expected_fields)
# ═════════════════════════════════════════════════════════════════════════════

TEST_CASES = [
    # ── Program + Semester + Intent ──
    {
        "query": "BS Computer Science semester 5 subjects",
        "expect": {
            "program_name": "BS Computer Science",
            "semester": 5,
            "chunk_type": "semester_subjects",
        },
    },
    {
        "query": "show me semester 3 courses of BSCS",
        "expect": {
            "program_name": "BS Computer Science",
            "semester": 3,
            "chunk_type": "semester_subjects",
        },
    },
    {
        "query": "ADP Chemistry semester 1 subject list",
        "expect": {
            "program_name": "ADP Chemistry",
            "semester": 1,
            "chunk_type": "semester_subjects",
        },
    },

    # ── Course code queries ──
    {
        "query": "course outline of COMP3149",
        "expect": {
            "course_code": "COMP3149",
            "chunk_type": "course_detail",
        },
    },
    {
        "query": "What is MATH2201 about?",
        "expect": {
            "course_code": "MATH2201",
            "chunk_type": "course_detail",
        },
    },
    {
        "query": "EDUC3184 course objectives",
        "expect": {
            "course_code": "EDUC3184",
            "chunk_type": "course_detail",
        },
    },

    # ── Admission queries ──
    {
        "query": "admission requirements for ADP Chemistry",
        "expect": {
            "program_name": "ADP Chemistry",
            "chunk_type": "admission",
        },
    },
    {
        "query": "how to get admission in BS Physics",
        "expect": {
            "program_name": "BS Physics",
            "chunk_type": "admission",
        },
    },

    # ── Program overview ──
    {
        "query": "what is BS Artificial Intelligence about?",
        "expect": {
            "program_name": "SOS of BS Artificial Intelligence",
            "chunk_type": "program_overview",
        },
    },
    {
        "query": "overview of BBA program",
        "expect": {
            "degree_type": "BBA",
            "chunk_type": "program_overview",
        },
    },

    # ── Credit hours / program design ──
    {
        "query": "credit hours for BS Mathematics",
        "expect": {
            "program_name": "BS Mathematics (4 Years)",
            "chunk_type": "program_design",
        },
    },
    {
        "query": "total credits in BBA",
        "expect": {
            "degree_type": "BBA",
            "chunk_type": "program_design",
        },
    },

    # ── Electives / list chunks ──
    {
        "query": "elective courses in BS Physics",
        "expect": {
            "program_name": "BS Physics",
            "chunk_type": "list_chunk",
        },
    },
    {
        "query": "specialization areas for BS Computer Science",
        "expect": {
            "program_name": "BS Computer Science",
            "chunk_type": "list_chunk",
        },
    },

    # ── Degree type extraction ──
    {
        "query": "BS post ADP English semester 1",
        "expect": {
            "degree_type": "BS (Post ADP)",
            "semester": 1,
        },
    },

    # ── Department fallback ──
    {
        "query": "semester 4 mathematics courses",
        "expect": {
            "department": "Mathematics",
            "semester": 4,
            "chunk_type": "semester_subjects",
        },
    },

    # ── Abbreviation handling ──
    {
        "query": "bs ai semester 3",
        "expect": {
            "program_name": "SOS of BS Artificial Intelligence",
            "semester": 3,
        },
    },
    {
        "query": "adp cs semester 2 subjects",
        "expect": {
            "program_name": "ADP Computer Science",
            "semester": 2,
            "chunk_type": "semester_subjects",
        },
    },
    {
        "query": "bed hons course outline",
        "expect": {
            "program_name": "B.Ed. (Hons)",
            "chunk_type": "course_detail",
        },
    },

    # ── No-filter queries (should return empty filter) ──
    {
        "query": "hello",
        "expect": {},
    },
    {
        "query": "what can you help me with?",
        "expect": {},
    },
]


def run_parser_tests():
    """Run all parser test cases and report results."""
    parser = QueryFilterParser()
    passed = 0
    failed = 0
    total = len(TEST_CASES)

    print("=" * 70)
    print("  QUERY FILTER PARSER — TEST SUITE")
    print("=" * 70)
    print()

    for i, tc in enumerate(TEST_CASES, 1):
        query = tc["query"]
        expected = tc["expect"]

        result = parser.parse(query, namespace="bs-adp-schemes")
        pinecone_filter = result.to_pinecone_filter()

        # Check each expected field
        errors = []
        for field, expected_value in expected.items():
            actual_value = getattr(result, field, None)
            if actual_value != expected_value:
                errors.append(f"    {field}: expected={expected_value!r}, got={actual_value!r}")

        if errors:
            print(f"  ❌ [{i}/{total}] {query}")
            for err in errors:
                print(err)
            print(f"    Rules: {result.matched_rules}")
            print(f"    Filter: {pinecone_filter}")
            failed += 1
        else:
            print(f"  ✅ [{i}/{total}] {query}")
            print(f"    → {result}")
            passed += 1
        print()

    print("=" * 70)
    print(f"  RESULTS: {passed}/{total} passed, {failed} failed")
    print("=" * 70)
    return failed == 0


def run_live_pinecone_tests():
    """Run actual Pinecone queries with parsed filters."""
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")

    from rag_pipeline.retriever import get_retriever

    parser = QueryFilterParser()
    retriever = get_retriever()

    live_queries = [
        "BS Computer Science semester 5 subjects",
        "course outline of COMP3149",
        "admission requirements for ADP Chemistry",
        "elective courses in BS Physics",
        "credit hours for BBA",
    ]

    print()
    print("=" * 70)
    print("  LIVE PINECONE FILTERED QUERIES")
    print("=" * 70)
    print()

    for query in live_queries:
        parsed = parser.parse(query, "bs-adp-schemes")
        print(f"  Query: {query}")
        print(f"  Parsed: {parsed}")

        if parsed.has_filters:
            docs, filter_used, quality = retriever.filtered_retrieve(
                query=query,
                namespace="bs-adp-schemes",
                filter_stages=parsed.relaxed_filters(),
                top_k=5,
            )
            print(f"  Quality: {quality}")
            print(f"  Filter used: {filter_used}")
            print(f"  Results: {len(docs)}")
            for d in docs[:3]:
                meta = d["metadata"]
                print(f"    - [{meta.get('chunk_type', '?')}] "
                      f"prog={meta.get('program_name', '?')} "
                      f"sem={meta.get('semester', '?')} "
                      f"code={meta.get('course_code', '?')} "
                      f"score={d['score']:.3f}")
        else:
            print(f"  → No filters extracted, would use pure semantic")
        print()


if __name__ == "__main__":
    all_passed = run_parser_tests()

    if "--live" in sys.argv:
        run_live_pinecone_tests()

    sys.exit(0 if all_passed else 1)
