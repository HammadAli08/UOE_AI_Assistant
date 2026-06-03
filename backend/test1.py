import requests
import sys

print("Script started", flush=True)

API_KEY = "sk-H30G9ZLburrfhMswv0EWCF5Tu5D0ZzlhRGdxZ0uAs0h7vZJk"
BASE_URL = "https://agentrouter.org/v1"

try:
    print("Sending request...", flush=True)
    response = requests.post(
        f"{BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": "gpt-5",
            "messages": [{"role": "user", "content": "Say hello."}],
            "max_tokens": 50,
        },
        timeout=30
    )
    print(f"Status code: {response.status_code}", flush=True)
    print(f"Raw response: {response.text}", flush=True)

except requests.exceptions.ConnectionError as e:
    print(f"Connection error: {e}", flush=True)
except requests.exceptions.Timeout:
    print("Request timed out after 30s", flush=True)
except Exception as e:
    print(f"Unexpected error: {type(e).__name__}: {e}", flush=True)

print("Script finished", flush=True)