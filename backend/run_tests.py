
import sys
import os
import json
import logging
from typing import Dict, List

# Add parent dir to path to import rag_pipeline
sys.path.append(os.path.join(os.getcwd(), "backend"))

from rag_pipeline import get_pipeline
from rag_pipeline.agentic_rag.voice_transliterator import VoiceTransliterator
from rag_pipeline.agentic_rag.voice_normalizer import VoiceNormalizer

# Suppress logs
logging.basicConfig(level=logging.ERROR)

def run_test(name, action_fn):
    print(f"Running Test: {name}...", end=" ", flush=True)
    try:
        result = action_fn()
        print(" [PASS]")
        return {"name": name, "result": "PASS", "details": result}
    except Exception as e:
        print(f" [FAIL] - {str(e)}")
        import traceback
        # traceback.print_exc()
        return {"name": name, "result": "FAIL", "details": str(e)}

def test_namespace_resolution():
    pipeline = get_pipeline()
    # Resolve 'bs-adp' should return 'bs-adp-schemes' based on config.py
    ns1 = pipeline._resolve_namespace("bs-adp")
    if ns1 != "bs-adp-schemes": raise Exception(f"Expected bs-adp-schemes, got {ns1}")
    return f"Resolved to {ns1}"

def test_transliteration():
    transliterator = VoiceTransliterator()
    text = "میرا داخلہ کب ہو گا؟"
    result = transliterator.transliterate(text)
    if not any(c in result.lower() for c in "abcdefghijklmnopqrstuvwxyz"):
        raise Exception(f"Output does not look like Roman Urdu: {result}")
    return result

def test_filter_parsing():
    pipeline = get_pipeline()
    query = "Course outline for COMP-1101"
    parsed = pipeline.filter_parser.parse(query, "bs-adp-schemes")
    if not parsed.course_code == "COMP1101":
        raise Exception(f"Failed to parse course code. Got {parsed.course_code}")
    if not parsed.chunk_type == "course_detail":
        raise Exception(f"Failed to parse chunk type. Got {parsed.chunk_type}")
    return str(parsed)

def test_rag_query():
    pipeline = get_pipeline()
    result = pipeline.query(
        user_query="Who is the Vice Chancellor of UOE?",
        namespace="about",
        enhance_query=True
    )
    if "answer" not in result or not result["answer"]:
        raise Exception("Empty answer from RAG")
    return result["answer"][:100]

def test_agentic_decomposition():
    pipeline = get_pipeline()
    result = pipeline.query(
        user_query="Tell me about BS CS and MS Mathematics",
        namespace="bs-adp",
        enable_agentic=True
    )
    return result.get("agentic_info", {})

if __name__ == "__main__":
    results = []
    results.append(run_test("Namespace Resolution", test_namespace_resolution))
    results.append(run_test("Voice Transliteration", test_transliteration))
    results.append(run_test("Filter Parsing", test_filter_parsing))
    results.append(run_test("RAG Query (Standard)", test_rag_query))
    results.append(run_test("Agentic Decomposition", test_agentic_decomposition))
    
    with open("test_results_detailed.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\nTests complete. Results saved to test_results_detailed.json")
