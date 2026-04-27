import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv("/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend/.env")

pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
index = pc.Index("uoeaiassistant")

namespaces = ["bs-adp-schemes", "ms-phd-schemes"]

fields_to_check = ["program_name", "degree_type", "department", "semester", "chunk_type", "is_legacy"]
found = {f: {'count': 0, 'types': set(), 'vals': set()} for f in fields_to_check}

# Let's try to query vectors and check for 'semester' specifically
for ns in namespaces:
    # Try querying multiple random vectors to ensure better coverage
    for offset in range(5):
        vec = [0.1] * 3072
        vec[offset * 100] = 0.5 # Add a bit of noise to get different results
        res = index.query(vector=vec, top_k=100, namespace=ns, include_metadata=True)
        for match in res['matches']:
            meta = match.get("metadata", {})
            for f in fields_to_check:
                if f in meta:
                    found[f]['count'] += 1
                    found[f]['types'].add(type(meta[f]).__name__)
                    found[f]['vals'].add(str(meta[f]))

for f in fields_to_check:
    print(f"\nField: {f}")
    print(f"  Count: {found[f]['count']}")
    print(f"  Types: {found[f]['types']}")
    # Limit printed vals to 10
    v_list = list(found[f]['vals'])
    if len(v_list) > 20:
        print(f"  Unique Values Sample: {v_list[:20]}")
    else:
        print(f"  Unique Values Sample: {v_list}")
