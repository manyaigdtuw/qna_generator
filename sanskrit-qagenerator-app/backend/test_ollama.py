import requests
import os
from dotenv import load_dotenv

load_dotenv()

def debug_ollama_error():
    """Check what specific error the Ollama server is returning"""
    try:
        ollama_url = os.getenv("OLLAMA_URL", "http://141.147.4.167:8080")
        model_name = os.getenv("MODEL_NAME", "gpt-oss:120b")
        
        print(f"Testing Ollama server: {ollama_url}")
        print(f"Testing model: {model_name}")
        
        response = requests.post(
            f"{ollama_url}/api/generate",
            json={
                "model": model_name, 
                "prompt": "test",
                "stream": False
            },
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response body: {response.text}")  # This will show the actual error message
    except Exception as e:
        print(f"Error: {e}")

def check_available_models():
    """Check what models are available on the server"""
    try:
        ollama_url = os.getenv("OLLAMA_URL", "http://141.147.4.167:8080")
        print(f"\nChecking available models on: {ollama_url}")
        
        response = requests.get(f"{ollama_url}/api/tags", timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            models = response.json().get('models', [])
            if models:
                print("Available models:")
                for model in models:
                    print(f"  - {model.get('name', 'Unknown')}")
            else:
                print("No models found on server")
        else:
            print(f"Error response: {response.text}")
    except Exception as e:
        print(f"Error checking models: {e}")

if __name__ == "__main__":
    print("=== Ollama Server Debug ===")
    check_available_models()
    print("\n=== Testing Generation ===")
    debug_ollama_error()