# Marseille Adapter

Type: model note
Status: active
Last reviewed: 2026-04-23

This directory contains the LoRA adapter artifacts for the Marseille deck vision model.

## Files

- `adapter_config.json` - PEFT adapter configuration
- `adapter_model.safetensors` - trained adapter weights

## Training Context

- Base model: `openai/clip-vit-base-patch32`
- Adapter format: PEFT LoRA
- Intended use: deck-style-aware tarot card retrieval and classification experiments in the local vision pipeline

For the current training workflow, see `scripts/training/README.md`.
