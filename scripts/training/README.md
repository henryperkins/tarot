# Tarot Vision Training Pipeline

This directory contains the Python-based training pipeline for the Tarot Vision system, replacing the legacy Node.js prototypes.

## Prerequisites

1.  **Python 3.10+**
2.  **CUDA-capable GPU** (recommended for training)
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Directory Structure

-   `trainLoRA.py`: Main script for fine-tuning the CLIP model using LoRA.
-   `buildVectorIndex.py`: Generates FAISS vector indices for fast card retrieval.
-   `requirements.txt`: Python dependencies.
-   `../../data/raw_images/{deck_name}/`: Place your raw card scans here (e.g., `data/raw_images/rws/`).

## Workflow

### 1. Data Ingestion
Place your high-resolution card scans in `data/raw_images/{deck_name}`.
Filenames should be descriptive (e.g., `01_magician.jpg`, `ace_of_cups.png`) as they are currently used for basic text prompting.

### 2. Train Model
Run the LoRA training script to adapt the CLIP model to your deck's art style.

```bash
python trainLoRA.py --deck rws --epochs 10 --batch_size 4
```

This will save the trained adapters to `models/adapters/rws`.

### 3. Build Vector Index
Generate a FAISS index for the deck using the trained model.

```bash
python buildVectorIndex.py --deck rws --adapter_path models/adapters/rws
```

This will save `index.faiss` and `metadata.json` to `data/indices/rws`.

## Legacy Scripts
-   `buildVisionPrototypes.js`: The old Node.js script for calculating static centroids. Kept for reference but deprecated.
