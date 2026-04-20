import sys
from pathlib import Path
sys.path.append("/mnt/data/hammadali08/PycharmProjects/UOE_AI_ASSISTANT/backend")
from rag_pipeline.query_filter_parser import QueryFilterParser

parser = QueryFilterParser()

q1 = parser.parse("What is the structure of BS SE?") 
q2 = parser.parse("BS SE scheme 2022")

print("Q1 Base Filter:", q1.to_pinecone_filter())
print("Q1 Relaxed Stages:")
for i, f in enumerate(q1.relaxed_filters()):
    print(f"  Stage {i}: {f}")

print("\nQ2 Base Filter:", q2.to_pinecone_filter())
print("Q2 Relaxed Stages:")
for i, f in enumerate(q2.relaxed_filters()):
    print(f"  Stage {i}: {f}")
