import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

PINECONE_INDEX = os.getenv("PINECONE_INDEX_NAME", "uoeaiassistant")
NAMESPACES = [
    "bs-adp-schemes",
    "ms-phd-schemes",
    "rules-regulations",
    "about-university"
]

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(PINECONE_INDEX)

for ns in NAMESPACES:
    print(f"\n{'='*40}")
    print(f"NAMESPACE: {ns}")
    print(f"{'='*40}")
    try:
        # A dummy vector of non-zeros for text-embedding-3-large dimension
        result = index.query(
            vector=[0.1] * 3072, 
            top_k=5,
            namespace=ns,
            include_metadata=True
        )
        if not result.matches:
            print("  No matches found (namespace might be empty).")
        for match in result.matches:
            chunk_type = match.metadata.get("chunk_type", "N/A")
            text_preview = match.metadata.get("text_preview", "N/A").replace("\n", " ")
            print(f"ID: {match.id}")
            print(f"Type: {chunk_type}")
            print(f"Preview: {text_preview[:80]}...")
            print("-" * 20)
    except Exception as e:
        print(f"  Error querying namespace: {e}")
