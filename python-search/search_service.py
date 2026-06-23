
from fastapi import FastAPI, Query
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import List

app = FastAPI()

# Load a lightweight model (80MB, runs on CPU)
model = SentenceTransformer('all-MiniLM-L6-v2')

# Mock product database – replace with your actual DB query
PRODUCTS = [
    {"id": "1", "title": "Wireless Bluetooth Headphones", "desc": "Noise cancelling, 30h battery"},
    {"id": "2", "title": "Running Shoes for Men", "desc": "Lightweight, breathable, cushioned"},
    {"id": "3", "title": "Organic Chemistry Textbook", "desc": "2nd edition, like new"},
    {"id": "4", "title": "Smartphone Stand", "desc": "Adjustable, foldable, desk mount"},
    {"id": "5", "title": "Yoga Mat", "desc": "Non-slip, eco-friendly, 6mm thick"},
]

# Pre‑compute embeddings for all products once
product_texts = [f"{p['title']} {p['desc']}" for p in PRODUCTS]
product_embeddings = model.encode(product_texts)   # shape (n_products, 384)

@app.get("/api/search")
def semantic_search(q: str = Query(..., min_length=1)):
    # Encode the user query
    query_emb = model.encode([q])
    # Cosine similarity
    similarities = cosine_similarity(query_emb, product_embeddings)[0]
    # Top 5 results
    top_indices = np.argsort(similarities)[::-1][:5]
    results = []
    for idx in top_indices:
        results.append({
            "id": PRODUCTS[idx]["id"],
            "title": PRODUCTS[idx]["title"],
            "description": PRODUCTS[idx]["desc"],
            "score": float(similarities[idx])
        })
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)