import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv("/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend/.env")

pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
index = pc.Index("uoeaiassistant")

res1 = index.query(vector=[0.1]*3072, top_k=20, namespace="bs-adp-schemes", filter={"is_legacy": {"$ne": True}})
res2 = index.query(vector=[0.1]*3072, top_k=20, namespace="bs-adp-schemes", filter={"is_legacy": {"$eq": False}})
res3 = index.query(vector=[0.1]*3072, top_k=20, namespace="bs-adp-schemes") # No filter

print(f"Count with $ne: True  -> {len(res1['matches'])}")
print(f"Count with $eq: False -> {len(res2['matches'])}")
print(f"Count with NO filter  -> {len(res3['matches'])}")
