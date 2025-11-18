import os
import argparse
import json
import torch
import faiss
import numpy as np
from PIL import Image
from tqdm import tqdm
from transformers import CLIPProcessor, CLIPModel
from peft import PeftModel

"""
Tarot Vision - Vector Index Builder
-----------------------------------
This script generates a FAISS vector index from card images using the CLIP model
(optionally with a trained LoRA adapter). This index replaces the static JSON
centroids for faster and more accurate card recognition.

Usage:
    python buildVectorIndex.py --deck rws --adapter_path models/adapters/rws
"""

def build_index(args):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Building vector index for deck: {args.deck} on {device}")

    # 1. Load Model
    model_id = "openai/clip-vit-base-patch32"
    model = CLIPModel.from_pretrained(model_id)
    processor = CLIPProcessor.from_pretrained(model_id)

    if args.adapter_path and os.path.exists(args.adapter_path):
        print(f"Loading LoRA adapter from {args.adapter_path}")
        model = PeftModel.from_pretrained(model, args.adapter_path)
        model = model.merge_and_unload() # Merge for faster inference
    else:
        print("Using base CLIP model (no adapter loaded)")

    model.to(device)
    model.eval()

    # 2. Prepare Data
    image_dir = os.path.join("data", "raw_images", args.deck)
    if not os.path.exists(image_dir):
        print(f"Error: Image directory {image_dir} not found.")
        return

    image_files = [f for f in os.listdir(image_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]
    if not image_files:
        print("No images found.")
        return

    print(f"Found {len(image_files)} images. Generating embeddings...")

    embeddings = []
    metadata = []

    # 3. Generate Embeddings
    with torch.no_grad():
        for idx, img_file in enumerate(tqdm(image_files)):
            img_path = os.path.join(image_dir, img_file)
            try:
                image = Image.open(img_path).convert("RGB")
                inputs = processor(images=image, return_tensors="pt").to(device)

                # Get image features
                image_features = model.get_image_features(**inputs)

                # Normalize features (important for cosine similarity)
                image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

                embeddings.append(image_features.cpu().numpy())

                # Store metadata
                card_name = img_file.split('.')[0].replace('_', ' ').replace('-', ' ')
                metadata.append({
                    "id": idx,
                    "filename": img_file,
                    "card_name": card_name
                })
            except Exception as e:
                print(f"Error processing {img_file}: {e}")

    if not embeddings:
        print("No embeddings generated.")
        return

    # 4. Build FAISS Index
    d = embeddings[0].shape[1] # Dimension of embeddings (512 for CLIP-ViT-B/32)
    embeddings_np = np.vstack(embeddings).astype('float32')

    # Use Inner Product (IP) index because vectors are normalized -> equivalent to Cosine Similarity
    index = faiss.IndexFlatIP(d)
    index.add(embeddings_np)

    print(f"Index built with {index.ntotal} vectors.")

    # 5. Save Artifacts
    output_dir = os.path.join("data", "indices", args.deck)
    os.makedirs(output_dir, exist_ok=True)

    index_path = os.path.join(output_dir, "index.faiss")
    metadata_path = os.path.join(output_dir, "metadata.json")

    faiss.write_index(index, index_path)
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved index to {index_path}")
    print(f"Saved metadata to {metadata_path}")

    # 6. Export to JSON (for Web App Integration)
    if args.export_json:
        export_path = args.export_json
        print(f"Exporting embeddings to JSON for web app: {export_path}")

        # Load existing if present to merge
        full_export = {}
        if os.path.exists(export_path):
            try:
                with open(export_path, 'r') as f:
                    full_export = json.load(f)
            except:
                pass

        if "deckStyles" not in full_export:
            full_export["deckStyles"] = {}

        # Map deck name to ID used in app (e.g., rws -> rws-1909)
        deck_id_map = {
            "rws": "rws-1909",
            "thoth": "thoth",
            "marseille": "marseille"
        }
        app_deck_id = deck_id_map.get(args.deck, args.deck)

        cards_data = {}
        for i, meta in enumerate(metadata):
            # Convert numpy float32 to standard float for JSON
            vec = embeddings[i].tolist()
            # Use canonical name as key
            cards_data[meta["card_name"]] = {
                "embedding": vec,
                "count": 1 # Single prototype for now
            }

        full_export["deckStyles"][app_deck_id] = {
            "cards": cards_data
        }

        os.makedirs(os.path.dirname(export_path), exist_ok=True)
        with open(export_path, 'w') as f:
            json.dump(full_export, f)
        print(f"Updated {export_path} with {len(cards_data)} cards for {app_deck_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build FAISS vector index for Tarot cards")
    parser.add_argument("--deck", type=str, required=True, help="Deck name (e.g., rws, thoth)")
    parser.add_argument("--adapter_path", type=str, help="Path to trained LoRA adapter")
    parser.add_argument("--export_json", type=str, help="Path to export JSON for web app (e.g., data/vision/fine-tuned/prototypes.json)")

    args = parser.parse_args()
    build_index(args)
