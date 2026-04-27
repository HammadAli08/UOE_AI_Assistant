import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv("/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend/.env")

pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
index = pc.Index("uoeaiassistant")

namespaces = ["bs-adp-schemes", "ms-phd-schemes", "about-university", "rules-regulations"]
metadata_samples = []

for ns in namespaces:
    # Use 0.1 to avoid all-zero vector, which breaks cosine similarity
    res = index.query(vector=[0.1]*3072, top_k=50, namespace=ns, include_metadata=True)
    print(f"Namespace: {ns}, Matches: {len(res['matches'])}")
    for match in res['matches']:
        meta = match.get("metadata", {})
        metadata_samples.append((ns, meta))

import collections
fields = collections.defaultdict(list)

for ns, m in metadata_samples:
    for k, v in m.items():
        fields[k].append((ns, type(v).__name__, v))

for k, vals in fields.items():
    types = set([t for _, t, _ in vals])
    unique_vals = set([str(v) for _, _, v in vals])
    presence = len(vals) / len(metadata_samples) * 100
    print(f"\nField: {k}")
    print(f"  Types: {types}")
    print(f"  Presence: {presence:.1f}%")
    if len(unique_vals) < 20:
        print(f"  Unique Values: {unique_vals}")
    else:
        print(f"  Unique Values: {len(unique_vals)} unique values (too many to print)")
