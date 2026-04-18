import json
from pinecone import Pinecone
from rag_pipeline.config import PINECONE_API_KEY, PINECONE_INDEX_NAME
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

# Get some vectors and print their names
res = index.query(
    vector=[0.01]*3072,
    namespace="bs-adp-schemes",
    top_k=50,
    include_metadata=True
)
programs = set(match.metadata.get("program_name") for match in res.matches if "program_name" in match.metadata)
print("Some program names in DB:", programs)
