import os
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("uoeaiassistant")

res = index.query(
    namespace="ms-phd-schemes",
    vector=[0.0] * 3072,  # Dummy vector
    filter={"course_code": {"$eq": "BUSA7186"}},
    top_k=5,
    include_metadata=True
)
print("BUSA7186:", res.matches)

res = index.query(
    namespace="ms-phd-schemes",
    vector=[0.0] * 3072,
    filter={"course_code": {"$in": ["HIST3116", "HIST 3116", "BUSA-7186"]}},
    top_k=5,
    include_metadata=True
)
print("HIST3116 / others:", res.matches)

# Let's search by text to see if the course code exists without being extracted properly
from langchain_openai import OpenAIEmbeddings
embed = OpenAIEmbeddings(model="text-embedding-3-large")
vec_busa = embed.embed_query("course objectives for BUSA7186 Data Analysis Techniques")

res_text = index.query(
    namespace="ms-phd-schemes",
    vector=vec_busa,
    top_k=2,
    include_metadata=True
)
print("\nSemantic search for BUSA7186:")
for m in res_text.matches:
    print(m.metadata.get("text", "")[:200])
    print(m.metadata)
    print("---")
