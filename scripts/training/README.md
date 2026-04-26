# Tarot Vision Training Pipeline

Type: guide
Status: active
Last reviewed: 2026-04-23

This directory contains a mixed training and data-prep toolchain for the vision system. Python scripts handle LoRA training, FAISS indexing, and test harnesses, while Node scripts handle dataset/export utilities and legacy prototype generation.

## Prerequisites

1. **Python 3.10+** for model training and FAISS tooling
2. **Node.js 20+** for dataset/export scripts already wired into the repo workflow
3. **CUDA-capable GPU** for practical training runs
4. Install Python dependencies when using the Python scripts:

```bash
pip install -r requirements.txt
```

## Directory Structure

- `trainLoRA.py` - fine-tunes the CLIP model using LoRA
- `buildVectorIndex.py` - generates FAISS vector indices for deck retrieval
- `testIndex.py` - local verification helper for generated indices
- `buildMultimodalDataset.js` - Node-based dataset assembly helper
- `exportReadings.js` - exports reading data for downstream training and evaluation
- `logToWandB.js` - WandB logging helper
- `buildVisionPrototypes.js` - older Node prototype builder retained for comparison
- `requirements.txt` - Python dependencies
- `../../data/raw_images/{deck_name}/` - raw source scans
- `../../data/indices/{deck_name}/` - generated FAISS indices and metadata

## Workflow

### RWS Grounding Dataset

Run `npm run training:rws-grounding` to emit multi-task JSONL records from the Rider-Waite-Smith evidence ontology. The output includes card identification, symbol grounding, tarot VQA, and absent-symbol checks. This complements `buildMultimodalDataset.js`, which remains the reading-level export path.

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

## Notes

- The Python path is the preferred training path.
- The Node scripts in this directory are still useful for data preparation, exports, and legacy comparisons; they are not all deprecated.
