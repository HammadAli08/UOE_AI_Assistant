import asyncio
from rag_pipeline.pipeline import RAGPipeline

async def run_e2e_test():
    pipeline = RAGPipeline()
    queries = [
        "ms cs semester 2 subjects",
        "phd management sciences admission requirements",
        "master of arts special education fee structure",
        "mphil economics thesis details"
    ]
    
    for q in queries:
        print(f"\n==============================================")
        print(f"QUERY: {q}")
        print(f"==============================================")
        try:
            # We must specify the namespace since it is a query context
            response = await pipeline.handle_query(
                query=q,
                namespace="ms-phd-schemes"
            )
            print(f"RESPONSE:\n{response.get('answer', 'NO ANSWER')}")
            print(f"\nSOURCES:")
            for src in response.get('sources', []):
                print(f" - {src}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
