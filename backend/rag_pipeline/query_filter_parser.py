"""
Query Filter Parser — Rule-Based Metadata Extraction

Deterministic, zero-latency extraction of Pinecone metadata filters
from user queries using regex + lookup tables.

Architecture:
    Rule-based parser (regex + lookup tables)
            ↓
    If uncertain → optional LLM fallback (disabled by default)

This parser extracts structured fields from free-form queries:
    - program_name → "BS Computer Science", "MSc Physics", "PhD Education"
    - degree_type  → "BS", "ADP", "BBA", "BFA", "B.Ed.", "MSc", "MA", "MPhil", "MS", "PhD", "PGD"
    - department   → "Computer Science", "Mathematics"
    - semester     → integer (no hard range)
    - course_code  → "COMP3149", "EDUC8112"
    - chunk_type   → "course_detail", "semester_subjects", etc.

Designed for the `bs-adp-schemes` and `ms-phd-schemes` namespaces in Pinecone.
Both namespaces share the same 6 canonical chunk types.
"""

import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# PARSED RESULT DATA CLASS
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class ParsedQuery:
    """Result of parsing a user query into structured metadata filters."""

    # Extracted fields (None = not detected)
    academic_year: Optional[str] = None
    program_name: Optional[str] = None
    degree_type: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None
    course_code: Optional[str] = None
    chunk_type: Optional[str] = None

    # Parser metadata
    confidence: float = 0.0
    matched_rules: List[str] = field(default_factory=list)

    def to_pinecone_filter(self) -> Dict[str, Any]:
        """
        Convert parsed fields to Pinecone metadata filter dict.
        Only includes fields that were successfully extracted.
        """
        f: Dict[str, Any] = {}
        
        # ── Legacy Isolation Strict Filter ──
        if self.academic_year:
            f["academic_year"] = {"$eq": self.academic_year}
        else:
            f["is_legacy"] = {"$ne": True}
            
        if self.program_name:
            f["program_name"] = {"$eq": self.program_name}
        if self.degree_type:
            f["degree_type"] = {"$eq": self.degree_type}
        if self.semester is not None:
            f["semester"] = {"$eq": self.semester}
        # Only strictly filter by course_code if we specifically want the course details.
        # Semester lists contain multiple courses but only one gets saved to the chunk's metadata!
        if self.course_code and self.chunk_type == "course_detail":
            f["course_code"] = {"$eq": self.course_code}
        if self.chunk_type:
            f["chunk_type"] = {"$eq": self.chunk_type}
        # department is only used as a fallback when program_name is not found
        if self.department and not self.program_name:
            f["department"] = {"$eq": self.department}
            
        return f

    def relaxed_filters(self) -> List[Dict[str, Any]]:
        """
        Generate progressively relaxed filter dicts for fallback.

        Relaxation order (drop weakest first):
            1. Full filter
            2. Drop semester
            3. Drop course_code
            4. Drop chunk_type
            5. Drop program_name (keep degree_type + department)
            6. Empty (pure semantic)
        """
        full = self.to_pinecone_filter()
        if not full:
            return [{}]

        stages = [full]

        # Stage 2: drop semester
        if "semester" in stages[-1]:
            relaxed = {k: v for k, v in stages[-1].items() if k != "semester"}
            if relaxed and relaxed not in stages:
                stages.append(relaxed)

        # Stage 3: drop department (especially critical if course_code is present, as it may be mis-inferred)
        if "department" in stages[-1]:
            relaxed = {k: v for k, v in stages[-1].items() if k != "department"}
            if relaxed and relaxed not in stages:
                stages.append(relaxed)

        # Stage 4: drop program_name and degree_type
        for key_to_drop in ["program_name", "degree_type"]:
            if key_to_drop in stages[-1]:
                relaxed = {k: v for k, v in stages[-1].items() if k != key_to_drop}
                if relaxed and relaxed not in stages:
                    stages.append(relaxed)

        # Stage 5: drop chunk_type
        if "chunk_type" in stages[-1]:
            relaxed = {k: v for k, v in stages[-1].items() if k != "chunk_type"}
            if relaxed and relaxed not in stages:
                stages.append(relaxed)

        # Stage 6: drop course_code (last resort before semantic)
        if "course_code" in stages[-1]:
            relaxed = {k: v for k, v in stages[-1].items() if k != "course_code"}
            if relaxed and relaxed not in stages:
                stages.append(relaxed)

        # Final: semantic fallback (CRITICAL: preserve isolation filter)
        base_semantic = {}
        if self.academic_year:
            base_semantic["academic_year"] = {"$eq": self.academic_year}
        else:
            base_semantic["is_legacy"] = {"$ne": True}
            
        if base_semantic not in stages:
            stages.append(base_semantic)

        return stages

    @property
    def has_filters(self) -> bool:
        # returns True if there's any filter besides the mandatory legacy exclusion
        f = self.to_pinecone_filter()
        relevant_keys = [k for k in f.keys() if k not in ("is_legacy", "academic_year")]
        return len(relevant_keys) > 0 or bool(self.academic_year)

    def __repr__(self) -> str:
        fields = []
        if self.academic_year:
            fields.append(f"year={self.academic_year}")
        if self.program_name:
            fields.append(f"prog={self.program_name}")
        if self.degree_type:
            fields.append(f"deg={self.degree_type}")
        if self.department:
            fields.append(f"dept={self.department}")
        if self.semester is not None:
            fields.append(f"sem={self.semester}")
        if self.course_code:
            fields.append(f"code={self.course_code}")
        if self.chunk_type:
            fields.append(f"type={self.chunk_type}")
        return f"ParsedQuery({', '.join(fields)}, conf={self.confidence:.2f})"


# ═════════════════════════════════════════════════════════════════════════════
# LOOKUP TABLES — built from actual Pinecone metadata enumeration
# ═════════════════════════════════════════════════════════════════════════════

# Exhaustive department map: (alias patterns → canonical department name)
DEPARTMENT_ALIASES: Dict[str, List[str]] = {
    "Computer Science": [
        "computer science", "cs", "comp sci", "compsci", "computing",
    ],
    "Artificial Intelligence": [
        "artificial intelligence", "ai",
    ],
    "Information Technology": [
        "information technology", "it ", "infotech",
    ],
    "Information Management": [
        "information management",
    ],
    "Mathematics": [
        "mathematics", "math", "maths",
    ],
    "Physics": [
        "physics", "phy",
    ],
    "Chemistry": [
        "chemistry", "chem",
    ],
    "Botany": [
        "botany", "botanical",
    ],
    "Zoology": [
        "zoology", "zoo",
    ],
    "English": [
        "english", "eng lit",
    ],
    "Urdu": [
        "urdu",
    ],
    "History": [
        "history",
    ],
    "Education": [
        "education", "edu",
    ],
    "Islamic Studies": [
        "islamic studies", "islamic",
    ],
    "Pakistan Studies": [
        "pakistan studies",
    ],
    "Economics": [
        "economics", "econ",
    ],
    "Business Administration": [
        "business administration", "business admin", "business",
    ],
    "Public Administration": [
        "public administration", "public admin",
    ],
    "Fine Arts": [
        "fine arts", "fine art",
    ],
    "Archaeology": [
        "archaeology", "archeology",
    ],
    # ── MS/PhD-specific departments ──
    "Special Education": [
        "special education", "sped",
    ],
    "Management Sciences": [
        "management sciences", "management science", "mgmt",
    ],
    "Educational Leadership and Policy Studies": [
        "educational leadership", "elps", "education leadership",
    ],
}

# Degree type aliases → canonical Pinecone value
# BS/ADP degree types
BS_ADP_DEGREE_ALIASES: Dict[str, List[str]] = {
    "BS": [
        "bs ", "b.s.", "bachelor of science", "bsc", "b.sc",
    ],
    "ADP": [
        "adp ", "adp-", "associate degree", "a.d.p",
    ],
    "BS (Post ADP)": [
        "post adp", "post-adp", "bs post adp",
    ],
    "BBA": [
        "bba", "bachelor of business",
    ],
    "BFA": [
        "bfa", "bachelor of fine arts",
    ],
    "B.Ed.": [
        "b.ed", "bed ", "bachelor of education", "b ed",
    ],
}

# MS/PhD degree types
MS_PHD_DEGREE_ALIASES: Dict[str, List[str]] = {
    "MSc": [
        "msc", "m.sc", "master of science (msc)",
    ],
    "MA": [
        "ma ", "m.a.", "master of arts",
    ],
    "M.Ed.": [
        "m.ed", "med ", "master of education",
    ],
    "MBA": [
        "mba", "master of business administration",
    ],
    "MPhil": [
        "mphil", "m.phil", "master of philosophy",
    ],
    "MS": [
        "ms ", "m.s.",
    ],
    "PhD": [
        "phd", "ph.d", "doctor of philosophy", "doctorate",
    ],
    "PGD": [
        "pgd", "post graduate diploma", "postgraduate diploma",
    ],
}

# Combined alias lookup (used by the parser; namespace selects which subset)
DEGREE_ALIASES: Dict[str, List[str]] = {**BS_ADP_DEGREE_ALIASES, **MS_PHD_DEGREE_ALIASES}

# Intent → chunk_type mapping
INTENT_CHUNK_TYPE_MAP: List[Tuple[List[str], str]] = [
    # Semester subject lists
    (
        [
            r"semester\s*\d+\s*(subjects?|courses?|course\s*list)",
            r"(subjects?|courses?)\s*(in|of|for)\s*semester",
            r"sem\s*\d+\s*(subjects?|courses?)",
            r"what\s*(subjects?|courses?)\s*(are\s*)?(in|for)\s*semester",
            r"list\s*(of\s*)?(subjects?|courses?)\s*(in|of|for)\s*semester",
            r"semester\s*[-–]?\s*[ivx]+\s*(subjects?|courses?)",
        ],
        "semester_subjects",
    ),
    # Course detail / outline
    (
        [
            r"course\s*(outline|detail|content|description|syllabus|overview)",
            r"outline\s*(of|for)",
            r"syllabus\s*(of|for)",
            r"(what|tell)\s*(is|me|about)\s*.*\bcourse\b",
            r"course\s*code\s*[A-Z]",
            r"course\s*(objectives?|outcomes?|clo|books?|readings?)",
            r"prerequisites?\s*(of|for)",
        ],
        "course_detail",
    ),
    # Admission requirements
    (
        [
            r"admission\s*(require|criteria|eligib|policy|rule)",
            r"(eligib|require)\s*(for|to)\s*(admiss|enter|enrol)",
            r"how\s*to\s*(get\s*)?admiss",
            r"entry\s*require",
            r"\badmissions?\b",
        ],
        "admission",
    ),
    # Program design / credit structure
    (
        [
            r"credit\s*hours?",
            r"program\s*(design|layout|structure|elaboration)",
            r"total\s*credits?",
            r"credit\s*distribution",
            r"categories\s*of\s*courses",
            r"course\s*categories",
        ],
        "program_design",
    ),
    # Program overview
    (
        [
            r"program\s*(overview|introduction|objective|mission|vision|aim)",
            r"(about|overview\s*of)\s*(the\s*)?(bs|adp|bba|bed|bfa|msc|ma|mphil|ms|phd|mba|pgd|m\.?ed)",
            r"what\s*is\s*(bs|adp|bba|bed|bfa|msc|ma|mphil|ms|phd|mba|pgd|m\.?ed)",
            r"department\s*of",
            r"program\s*(goal|purpose)",
            # MS/PhD-specific: comprehensive exam, academic honesty → program-level policy
            r"comprehensive\s*exam",
            r"academic\s*honesty",
            r"plagiarism\s*policy",
            r"study\s*tour",
            r"field\s*visit",
        ],
        "program_overview",
    ),
    # Program design (credit structure, thesis, deficiency, degree requirements)
    (
        [
            r"thesis\s*(requirement|option|alternative|detail)",
            r"dissertation\s*(requirement|detail)",
            r"deficiency\s*course",
            r"internship\s*(requirement|detail)",
            r"teaching\s*practice",
            r"degree\s*(requirement|completion)",
        ],
        "program_design",
    ),
    # List chunks (electives, specializations, fee structure)
    (
        [
            r"elective\s*(courses?|subjects?|options?|list)",
            r"specialization\s*(areas?|options?|list|courses?|tracks?)",
            r"allied\s*(courses?|subjects?)",
            r"minor\s*(courses?|subjects?)",
            r"list\s*of\s*(elective|specialization|allied)",
            r"optional\s*(courses?|subjects?)",
            r"fee\s*(structure|amount|payment|detail)",
            r"tuition\s*(fee|amount)",
            r"compulsory\s*(courses?|subjects?)\s*list",
        ],
        "list_chunk",
    ),
]

# Course code prefix → department mapping (for reverse lookup)
COURSE_CODE_PREFIX_MAP: Dict[str, str] = {
    "COMP": "Computer Science",
    "CSCI": "Computer Science",
    "MATH": "Mathematics",
    "PHYS": "Physics",
    "CHEM": "Chemistry",
    "BOTN": "Botany",
    "ZOOL": "Zoology",
    "EDUC": "Education",
    "ENGL": "English",
    "URDU": "Urdu",
    "HIST": "History",
    "ISLM": "Islamic Studies",
    "PAKS": "Pakistan Studies",
    "ECON": "Economics",
    "BUSA": "Business Administration",
    "BUAS": "Business Administration",
    "ARCH": "Archaeology",
    "ARTS": "Fine Arts",
    "PSYC": "Education",
    "SPED": "Special Education",
    # Additional prefixes found in MS/PhD documents
    "MGMT": "Management Sciences",
    "STAT": "Mathematics",
    "BNQE": "Education",
    "SEED": "Special Education",
    "ITEC": "Information Technology",
}

# Exact program name shortcuts — common abbreviations users type
# ── BS/ADP shortcuts ──
BS_ADP_PROGRAM_SHORTCUTS: Dict[str, str] = {
    "bscs": "BS Computer Science",
    "bs cs": "BS Computer Science",
    "bs computer science": "BS Computer Science",
    "bs ai": "SOS of BS Artificial Intelligence",
    "bs artificial intelligence": "SOS of BS Artificial Intelligence",
    "bs it": "BS Information Technology",
    "bs information technology": "BS Information Technology",
    "bs math": "BS Mathematics (4 Years)",
    "bs mathematics": "BS Mathematics (4 Years)",
    "bs physics": "BS Physics",
    "bs chemistry": "BS Chemistry (4 Years)",
    "bs chem": "BS Chemistry (4 Years)",
    "bs botany": "BS Botany",
    "bs zoology": "BS Zoology",
    "bs economics": "BS Economics (4 Years)",
    "bs econ": "BS Economics (4 Years)",
    "bs english": "BS English 4 Years Program",
    "bs urdu": "BS Urdu",
    "bs history": "BS History",
    "bs islamic studies": "BS Islamic Studies",
    "bs pakistan studies": "BS Pakistan Studies",
    "bs archaeology": "BS Archaeology",
    "bs physical education": "BS Physical Education and Sports Sciences",
    "bs sports": "BS Physical Education and Sports Sciences",
    "bs public admin": "BS Public Administration (4 Years)",
    "bs public administration": "BS Public Administration (4 Years)",
    "bs information management": "BS Information Management",
    "bs business analytics": "BS Business Analytics (4 Years)",
    "adp cs": "ADP Computer Science",
    "adp computer science": "ADP Computer Science",
    "adp it": "ADP Information Technology (2 Years)",
    "adp math": "ADP Mathematics (2 Years)",
    "adp mathematics": "ADP Mathematics (2 Years)",
    "adp physics": "ADP Physics",
    "adp chemistry": "ADP Chemistry",
    "adp chem": "ADP Chemistry",
    "adp english": "ADP English",
    "adp urdu": "ADP Urdu",
    "adp botany": "ADP Botany (2 Years)",
    "adp zoology": "ADP Zoology",
    "adp economics": "ADP Economics (2 Years)",
    "adp econ": "ADP Economics (2 Years)",
    "adp history": "ADP History",
    "adp islamic studies": "ADP Islamic Studies",
    "adp pakistan studies": "ADP Pakistan Studies",
    "adp special education": "ADP Special Education (2 Years)",
    "adp business": "ADP Business Administration",
    "adp business admin": "ADP Business Administration",
    "bba": "BBA (4 Years)",
    "bba 4 years": "BBA (4 Years)",
    "bba post adp": "BBA (Post ADP)",
    "bfa": "BFA",
    "bfa painting": "BFA (Painting)",
    "bfa graphic design": "BFA (Graphic Design)",
    "bed": "B.Ed. (4 Years)",
    "b.ed": "B.Ed. (4 Years)",
    "b.ed hons": "B.Ed. (Hons)",
    "bed hons": "B.Ed. (Hons)",
    "b.ed elm": "B.Ed. (Hons) ELM",
    "bed special education": "B.Ed. (Hons) Special Education",
    "b.ed special education": "B.Ed. (Hons) Special Education",
    "bs cs post adp": "BS Computer Science (Post ADP)",
    "bs english post adp": "BS English (Post ADP)",
    "bs history post adp": "BS History (Post ADP)",
    "bs urdu post adp": "BS Urdu (Post ADP)",
    "bs botany post adp": "BS Botany (Post ADP)",
    "bs islamic studies post adp": "BS Islamic Studies (Post ADP)",
    "bs zoology post adp": "Bachelor of Science in Zoology (BS Zoology) (2 Years Program)",
}

# ── MS/PhD shortcuts ──
MS_PHD_PROGRAM_SHORTCUTS: Dict[str, str] = {
    # MSc programs
    "msc physics": "MSc Physics",
    "msc phy": "MSc Physics",
    "msc chemistry": "MSc Chemistry",
    "msc chem": "MSc Chemistry",
    "msc mathematics": "MSc Mathematics",
    "msc math": "MSc Mathematics",
    "msc maths": "MSc Mathematics",
    "msc zoology": "MSc Zoology",
    "msc zoo": "MSc Zoology",
    "msc botany": "MSc Botany",
    "msc economics": "MSc Economics",
    "msc econ": "MSc Economics",
    "msc it": "MSc Information Technology",
    "msc information technology": "MSc Information Technology",
    # MA programs
    "ma history": "MA History",
    "ma education": "MA Education",
    "ma edu": "MA Education",
    "ma english": "MA English",
    "ma urdu": "MA Urdu",
    "ma special education": "MA Special Education",
    "ma sped": "MA Special Education",
    "ma education leadership": "MA Education (Leadership and Management)",
    "ma leadership": "MA Education (Leadership and Management)",
    # M.Ed. programs
    "med": "MEd",
    "m.ed": "MEd",
    "m ed": "MEd",
    "med special education": "MEd Special Education",
    "m.ed special education": "MEd Special Education",
    # MBA programs
    "mba": "MBA",
    "mba 1.5": "MBA 1.5 Year",
    "mba 1.5 year": "MBA 1.5 Year",
    "mba 1.5 years": "MBA 1.5 Year",
    "mba 3.5": "MBA 3.5 Years",
    "mba 3.5 year": "MBA 3.5 Years",
    "mba 3.5 years": "MBA 3.5 Years",
    # MPhil programs
    "mphil education": "MPhil Education",
    "mphil edu": "MPhil Education",
    "mphil urdu": "MPhil Urdu",
    "mphil economics": "MPhil Economics",
    "mphil econ": "MPhil Economics",
    "mphil english linguistics": "MPhil English (Linguistics)",
    "mphil english literature": "MPhil English (Literature)",
    "mphil elps": "MPhil Educational Leadership and Policy Studies",
    "mphil educational leadership": "MPhil Educational Leadership and Policy Studies",
    "mphil history": "MPhil History Arts and Cultural Heritage",
    "mphil islamic studies": "MPhil Islamic Studies",
    "mphil special education": "MPhil Special Education",
    "mphil sped": "MPhil Special Education",
    # MS programs
    "ms botany": "MS Botany",
    "ms chemistry": "MS Chemistry",
    "ms chem": "MS Chemistry",
    "ms computer science": "MS Computer Science",
    "ms cs": "MS Computer Science",
    "ms it": "MS Information Technology",
    "ms information technology": "MS Information Technology",
    "ms math": "MS Mathematics",
    "ms mathematics": "MS Mathematics",
    "ms physics": "MS Physics",
    "ms phy": "MS Physics",
    "ms zoology": "MS Zoology",
    "ms zoo": "MS Zoology",
    "ms management": "MS Management Sciences",
    "ms management sciences": "MS Management Sciences",
    # PhD programs
    "phd education": "PhD Education",
    "phd edu": "PhD Education",
    "phd botany": "PhD Botany",
    "phd chemistry": "PhD Chemistry",
    "phd chem": "PhD Chemistry",
    "phd economics": "PhD Economics",
    "phd econ": "PhD Economics",
    "phd english": "PhD English (Linguistics)",
    "phd english linguistics": "PhD English (Linguistics)",
    "phd elps": "PhD Educational Leadership and Policy Studies",
    "phd educational leadership": "PhD Educational Leadership and Policy Studies",
    "phd history": "PhD History Arts and Cultural Heritage",
    "phd islamic studies": "PhD Islamic Studies",
    "phd management": "PhD Management Sciences",
    "phd management sciences": "PhD Management Sciences",
    "phd math": "PhD Mathematics",
    "phd mathematics": "PhD Mathematics",
    "phd physics": "PhD Physics",
    "phd phy": "PhD Physics",
    "phd special education": "PhD Special Education",
    "phd sped": "PhD Special Education",
    "phd urdu": "PhD Urdu",
    "phd zoology": "PhD Zoology",
    "phd zoo": "PhD Zoology",
    # PGD programs
    "pgd asd": "PGD ASD",
    "pgd slt": "PGD SLT",
}

# Legacy alias — kept for any external code referencing PROGRAM_SHORTCUTS directly
PROGRAM_SHORTCUTS: Dict[str, str] = BS_ADP_PROGRAM_SHORTCUTS

# Roman numeral map
ROMAN_MAP = {
    "i": 1, "ii": 2, "iii": 3, "iv": 4,
    "v": 5, "vi": 6, "vii": 7, "viii": 8,
}


# ═════════════════════════════════════════════════════════════════════════════
# RULE-BASED PARSER
# ═════════════════════════════════════════════════════════════════════════════

# Namespaces supported by this parser
_SUPPORTED_NAMESPACES = {"bs-adp-schemes", "ms-phd-schemes"}


class QueryFilterParser:
    """
    Deterministic, rule-based query parser for structured scheme namespaces.

    Supports:
        - bs-adp-schemes  (BS, ADP, BBA, BFA, B.Ed.)
        - ms-phd-schemes  (MSc, MA, M.Ed., MBA, MPhil, MS, PhD, PGD)

    Both namespaces share the same 6 canonical chunk types.
    Namespace determines which shortcut table and degree aliases to use.

    Zero latency. Zero LLM calls. Fully deterministic.
    """

    def __init__(self):
        # Pre-compile intent patterns for performance
        self._intent_patterns: List[Tuple[List["re.Pattern"], str]] = []
        for patterns, chunk_type in INTENT_CHUNK_TYPE_MAP:
            compiled = [re.compile(p, re.IGNORECASE) for p in patterns]
            self._intent_patterns.append((compiled, chunk_type))

    def parse(self, query: str, namespace: str = "bs-adp-schemes") -> ParsedQuery:
        """
        Parse a user query into a structured ParsedQuery.

        Args:
            query: Raw or enhanced user query string
            namespace: Target namespace (bs-adp-schemes or ms-phd-schemes)

        Returns:
            ParsedQuery with extracted metadata fields and confidence score
        """
        if namespace not in _SUPPORTED_NAMESPACES:
            # Only structured scheme namespaces benefit from filter parsing
            return ParsedQuery(confidence=0.0, matched_rules=["namespace_skip"])

        if not query or not query.strip():
            return ParsedQuery(confidence=0.0, matched_rules=["empty_query"])

        q = query.strip()
        q_lower = q.lower()
        q_normalized = re.sub(r'\s+', ' ', q_lower)

        result = ParsedQuery()

        # ── Step 1: Extract course code (highest priority, most specific) ──
        self._extract_course_code(q, result)
        
        # ── Step 1.5: Extract academic year ──
        self._extract_academic_year(q_normalized, result, namespace)

        # ── Step 2: Extract semester number ──
        self._extract_semester(q_lower, result)

        # ── Step 3: Extract degree type FIRST (must detect "post adp" before shortcuts) ──
        self._extract_degree_type(q_normalized, result, namespace=namespace)

        # ── Step 4: Resolve program name via shortcuts (namespace-aware) ──
        self._extract_program_shortcut(q_normalized, result, namespace=namespace)

        # ── Step 5: Extract department (if program not yet found) ──
        self._extract_department(q_normalized, result)

        # ── Step 6: Build program_name from degree + department if not yet set ──
        self._infer_program_from_components(result, namespace=namespace)

        # ── Step 7: Detect intent → chunk_type ──
        self._extract_chunk_type(q_normalized, result)

        # ── Step 8: Infer chunk_type from context clues ──
        self._infer_chunk_type_from_context(q_normalized, result)

        # ── Step 9: Calculate confidence ──
        self._calculate_confidence(result)

        logger.info("🔍 Parsed query: %s → %s", q[:80], result)
        return result

    # ── Extraction methods ────────────────────────────────────────────

    def _extract_course_code(self, query: str, result: ParsedQuery) -> None:
        """Extract course code like COMP3149, MATH2201."""
        patterns = [
            r'\b([A-Z]{2,4})\s*[-]?\s*(\d{4})\b',
            r'\b([A-Z]{2,4})\s*[-]?\s*(\d{3})\b',
        ]
        for pat in patterns:
            m = re.search(pat, query)
            if m:
                code = (m.group(1) + m.group(2)).upper()
                result.course_code = code
                result.matched_rules.append(f"course_code:{code}")

                # Infer department from code prefix
                prefix = m.group(1).upper()
                if prefix in COURSE_CODE_PREFIX_MAP:
                    dept = COURSE_CODE_PREFIX_MAP[prefix]
                    if not result.department:
                        result.department = dept
                        result.matched_rules.append(f"dept_from_code:{dept}")
                return

    def _extract_academic_year(self, q_normalized: str, result: ParsedQuery, namespace: str) -> None:
        """Extract academic year e.g. 2018, 2022 from query for bs-adp old schemes ONLY."""
        if namespace != "bs-adp-schemes":
            return

        text_to_search = q_normalized
        if result.course_code:
            # We must remove the course code numbers to avoid false positive year
            course_num = ''.join(c for c in result.course_code if c.isdigit())
            if course_num:
                text_to_search = text_to_search.replace(course_num, "")

        m = re.search(r'\b(201\d|202\d|203\d)\b', text_to_search)
        if m:
            extracted_year = m.group(1)
            year_int = int(extracted_year)
            
            # The year was only saved in metadata for "old schemes". New schemes do not have year metadata.
            # So we only set this filter if the user asks for a pre-2023 year OR explicitly mentions "old"
            is_old_scheme_query = year_int < 2023 or re.search(r'\b(old|previous|past|legacy|former)\b', q_normalized)
            
            if is_old_scheme_query:
                result.academic_year = extracted_year
                result.matched_rules.append(f"academic_year:{result.academic_year}")

    def _extract_semester(self, q_lower: str, result: ParsedQuery) -> None:
        """Extract semester number. No hard range cap — document data dictates valid values."""
        patterns = [
            # "semester 5", "sem 5", "semester-5"
            (r'(?:semester|sem)\s*[-–]?\s*(\d{1,2})\b', "digit"),
            # "semester V", "sem-III"
            (r'(?:semester|sem)\s*[-–]?\s*([ivx]+)\b', "roman"),
            # "5th semester", "3rd semester"
            (r'(\d{1,2})(?:st|nd|rd|th)\s*semester\b', "ordinal"),
        ]
        for pat, pat_type in patterns:
            m = re.search(pat, q_lower)
            if m:
                val = m.group(1)
                if pat_type == "roman":
                    sem = ROMAN_MAP.get(val.lower())
                else:
                    try:
                        sem = int(val)
                    except ValueError:
                        sem = None

                if sem and sem >= 1:
                    result.semester = sem
                    result.matched_rules.append(f"semester:{sem}")
                    return

    def _extract_program_shortcut(self, q_normalized: str, result: ParsedQuery,
                                   namespace: str = "bs-adp-schemes") -> None:
        """Match query against known program shortcuts. Namespace-aware."""
        # Select the correct shortcut table for the target namespace
        if namespace == "ms-phd-schemes":
            shortcuts = MS_PHD_PROGRAM_SHORTCUTS
        else:
            shortcuts = BS_ADP_PROGRAM_SHORTCUTS

        # Sort by length descending so longer matches win
        for shortcut, canonical in sorted(
            shortcuts.items(), key=lambda x: len(x[0]), reverse=True
        ):
            if shortcut in q_normalized:
                # When degree is "BS (Post ADP)", skip plain ADP shortcuts
                # to prevent "adp english" matching in "BS post ADP English"
                if (result.degree_type == "BS (Post ADP)"
                        and shortcut.startswith("adp ")
                        and "post" not in shortcut):
                    continue

                result.program_name = canonical
                result.matched_rules.append(f"shortcut:{shortcut}→{canonical}")
                # Also set degree type from the canonical name (if not already set)
                if not result.degree_type:
                    for deg, aliases in DEGREE_ALIASES.items():
                        if canonical.lower().startswith(deg.lower().rstrip(". ")):
                            result.degree_type = deg
                            break
                return

    def _extract_degree_type(self, q_normalized: str, result: ParsedQuery, namespace: str = "bs-adp-schemes") -> None:
        """Extract degree type from query."""
        if result.degree_type:
            return

        # Check for "post adp" first (more specific)
        if namespace == "bs-adp-schemes":
            if re.search(r'post\s*[-]?\s*adp', q_normalized):
                result.degree_type = "BS (Post ADP)"
                result.matched_rules.append("degree:BS (Post ADP)")
                return

            allowed_degrees = {"BS", "ADP", "BBA", "BFA", "B.Ed."}
        else:
            allowed_degrees = {"MSc", "MA", "MEd", "MBA", "MPhil", "MS", "PhD", "PGD"}

        for deg_type, aliases in DEGREE_ALIASES.items():
            if deg_type not in allowed_degrees:
                continue
                
            for alias in aliases:
                # Use word boundary for short aliases
                if len(alias.strip()) <= 3:
                    if re.search(r'\b' + re.escape(alias.strip()) + r'\b', q_normalized):
                        result.degree_type = deg_type
                        result.matched_rules.append(f"degree:{deg_type}")
                        return
                else:
                    if alias in q_normalized:
                        result.degree_type = deg_type
                        result.matched_rules.append(f"degree:{deg_type}")
                        return

    def _extract_department(self, q_normalized: str, result: ParsedQuery) -> None:
        """Extract department from query."""
        if result.department:
            return

        # Sort by longest match first to prevent partial matches
        for dept, aliases in sorted(
            DEPARTMENT_ALIASES.items(), key=lambda x: max(len(a) for a in x[1]), reverse=True
        ):
            for alias in aliases:
                if len(alias.strip()) <= 3:
                    if re.search(r'\b' + re.escape(alias.strip()) + r'\b', q_normalized):
                        result.department = dept
                        result.matched_rules.append(f"department:{dept}")
                        return
                else:
                    if alias in q_normalized:
                        result.department = dept
                        result.matched_rules.append(f"department:{dept}")
                        return

    def _infer_program_from_components(self, result: ParsedQuery,
                                       namespace: str = "bs-adp-schemes") -> None:
        """Build program_name from degree_type + department if not already set."""
        if result.program_name:
            return

        if result.degree_type and result.department:
            # Try to construct a program name that matches Pinecone data
            candidate = f"{result.degree_type} {result.department}"
            # Check known shortcuts in reverse (namespace-aware)
            if namespace == "ms-phd-schemes":
                shortcuts = MS_PHD_PROGRAM_SHORTCUTS
            else:
                shortcuts = BS_ADP_PROGRAM_SHORTCUTS

            canonical = None
            for shortcut, prog_name in shortcuts.items():
                if prog_name.lower().startswith(candidate.lower()):
                    canonical = prog_name
                    break

            if canonical:
                result.program_name = canonical
            else:
                # Use constructed name as-is (Pinecone will filter)
                result.program_name = candidate

            result.matched_rules.append(f"inferred_program:{result.program_name}")

    def _extract_chunk_type(self, q_normalized: str, result: ParsedQuery) -> None:
        """Detect user intent and map to chunk_type."""
        if result.chunk_type:
            return

        for compiled_patterns, chunk_type in self._intent_patterns:
            for pattern in compiled_patterns:
                if pattern.search(q_normalized):
                    result.chunk_type = chunk_type
                    result.matched_rules.append(f"intent:{chunk_type}")
                    return

    def _infer_chunk_type_from_context(self, q_normalized: str, result: ParsedQuery) -> None:
        """Infer chunk_type when no explicit intent was detected."""
        if result.chunk_type:
            return

        # If course_code is present, user likely wants course detail
        if result.course_code:
            result.chunk_type = "course_detail"
            result.matched_rules.append("inferred_type:course_detail_from_code")
            return

        # If semester is present without other intent, likely wants subject list
        if result.semester is not None:
            result.chunk_type = "semester_subjects"
            result.matched_rules.append("inferred_type:semester_subjects_from_sem")
            return

    def _calculate_confidence(self, result: ParsedQuery) -> None:
        """Calculate confidence score based on matched fields."""
        score = 0.0
        weights = {
            "course_code": 0.35,
            "program_name": 0.25,
            "chunk_type": 0.20,
            "semester": 0.10,
            "degree_type": 0.05,
            "department": 0.05,
        }

        if result.course_code:
            score += weights["course_code"]
        if result.program_name:
            score += weights["program_name"]
        if result.chunk_type:
            score += weights["chunk_type"]
        if result.semester is not None:
            score += weights["semester"]
        if result.degree_type:
            score += weights["degree_type"]
        if result.department:
            score += weights["department"]

        result.confidence = round(score, 2)


# ═════════════════════════════════════════════════════════════════════════════
# SINGLETON
# ═════════════════════════════════════════════════════════════════════════════

_parser: Optional[QueryFilterParser] = None


def get_query_filter_parser() -> QueryFilterParser:
    """Get or create QueryFilterParser singleton."""
    global _parser
    if _parser is None:
        _parser = QueryFilterParser()
    return _parser
