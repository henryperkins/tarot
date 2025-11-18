import argparse
import os
import json
import torch
import faiss
import numpy as np
from transformers import CLIPProcessor, CLIPModel
from peft import PeftModel

"""
Tarot Vision - Index Verification Script
----------------------------------------
This script loads the generated FAISS index and queries it with a text description
to verify that the training and indexing process was successful.

Usage:
    python scripts/training/testIndex.py --deck rws --query "a tarot card of the magician"
"""

def test_index(args):
    print(f"Testing index for deck: {args.deck}")

    # 1. Load Index and Metadata
    index_path = os.path.join("data", "indices", args.deck, "index.faiss")
    metadata_path = os.path.join("data", "indices", args.deck, "metadata.json")

    if not os.path.exists(index_path) or not os.path.exists(metadata_path):
        print(f"Error: Index or metadata not found in data/indices/{args.deck}")
        return

    index = faiss.read_index(index_path)
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)

    print(f"Loaded index with {index.ntotal} vectors.")

    # 2. Load Model (Base + Adapter)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_id = "openai/clip-vit-base-patch32"
    model = CLIPModel.from_pretrained(model_id)
    processor = CLIPProcessor.from_pretrained(model_id)

    adapter_path = os.path.join("models", "adapters", args.deck)
    if os.path.exists(adapter_path):
        print(f"Loading LoRA adapter from {adapter_path}")
        model = PeftModel.from_pretrained(model, adapter_path)
        model = model.merge_and_unload()
    else:
        print("Warning: Adapter not found, using base model.")

    model.to(device)
    model.eval()

    # 3. Encode Query
    print(f"Query: '{args.query}'")
    inputs = processor(text=[args.query], return_tensors="pt", padding=True).to(device)

    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        # Normalize
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
        query_vector = text_features.cpu().numpy().astype('float32')

    # 4. Search
    k = 5 # Top 5 results
    D, I = index.search(query_vector, k)

    print("\n--- Search Results ---")
    for i in range(k):
        idx = I[0][i]
        score = D[0][i]
        if idx < len(metadata):
            card_info = metadata[idx]
            print(f"Rank {i+1}: {card_info['card_name']} (Score: {score:.4f})")
            print(f"        File: {card_info['filename']}")
        else:
            print(f"Rank {i+1}: Unknown Index {idx}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Tarot Vision Index")
    parser.add_argument("--deck", type=str, default="rws", help="Deck name")
    parser.add_argument("--query", type=str, default="a tarot card of the fool", help="Text query")

    args = parser.parse_args()
    test_index(args)
