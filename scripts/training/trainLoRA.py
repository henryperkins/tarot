import os
import argparse
import torch
from transformers import CLIPProcessor, CLIPModel
from peft import LoraConfig, get_peft_model
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from tqdm import tqdm

"""
Tarot Vision - LoRA Training Script
-----------------------------------
This script implements the Low-Rank Adaptation (LoRA) fine-tuning pipeline for the Tarot Vision model.
It is designed to teach the base CLIP model specific artistic styles (RWS, Thoth, Marseille) and
esoteric symbolism without destroying its pre-trained knowledge.

Usage:
    python trainLoRA.py --deck rws --epochs 5 --batch_size 4
"""

class TarotCardDataset(Dataset):
    def __init__(self, image_dir, processor):
        self.image_dir = image_dir
        self.processor = processor
        self.images = [f for f in os.listdir(image_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]
        if not self.images:
            print(f"Warning: No images found in {image_dir}")

    def __len__(self):
        return len(self.images)

    def __getitem__(self, idx):
        img_name = self.images[idx]
        img_path = os.path.join(self.image_dir, img_name)
        image = Image.open(img_path).convert("RGB")

        # Basic text prompt for now - in future will use detailed descriptions
        # Clean filename to get card name (e.g., "01_magician.jpg" -> "magician")
        clean_name = img_name.split('.')[0].replace('_', ' ').replace('-', ' ')
        text = f"a tarot card of {clean_name}"

        processed = self.processor(
            text=[text],
            images=image,
            return_tensors="pt",
            padding="max_length",
            truncation=True,
            max_length=77
        )

        return {
            "pixel_values": processed["pixel_values"].squeeze(),
            "input_ids": processed["input_ids"].squeeze(),
            "attention_mask": processed["attention_mask"].squeeze()
        }

def train(args):
    print(f"Initializing LoRA training for deck: {args.deck}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    # 1. Load Base Model
    model_id = "openai/clip-vit-base-patch32"
    model = CLIPModel.from_pretrained(model_id)
    processor = CLIPProcessor.from_pretrained(model_id)

    # 2. Configure LoRA
    # Target specific modules in the vision encoder for style adaptation
    config = LoraConfig(
        r=16,
        lora_alpha=16,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.1,
        bias="none",
        modules_to_save=["classifier"],
    )

    lora_model = get_peft_model(model, config)
    lora_model.print_trainable_parameters()
    lora_model.to(device)

    # 3. Prepare Data
    dataset_path = os.path.join("data", "raw_images", args.deck)
    if not os.path.exists(dataset_path):
        print(f"Warning: Dataset path {dataset_path} does not exist. Creating dummy dataset for structure verification.")
        os.makedirs(dataset_path, exist_ok=True)

    dataset = TarotCardDataset(dataset_path, processor)
    if len(dataset) == 0:
        print("No data found. Skipping training loop.")
        return

    dataloader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)

    # 4. Training Loop
    optimizer = torch.optim.AdamW(lora_model.parameters(), lr=5e-5)
    lora_model.train()

    print(f"Starting training for {args.epochs} epochs...")

    for epoch in range(args.epochs):
        total_loss = 0
        progress_bar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{args.epochs}")

        for batch in progress_bar:
            pixel_values = batch["pixel_values"].to(device)
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)

            outputs = lora_model(
                pixel_values=pixel_values,
                input_ids=input_ids,
                attention_mask=attention_mask,
                return_loss=True
            )

            loss = outputs.loss
            loss.backward()

            optimizer.step()
            optimizer.zero_grad()

            total_loss += loss.item()
            progress_bar.set_postfix({"loss": loss.item()})

        avg_loss = total_loss / len(dataloader)
        print(f"Epoch {epoch+1} completed. Average Loss: {avg_loss:.4f}")

    # 5. Save Adapter
    output_dir = os.path.join("models", "adapters", args.deck)
    os.makedirs(output_dir, exist_ok=True)
    lora_model.save_pretrained(output_dir)
    print(f"LoRA adapters saved to {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train LoRA adapter for Tarot Vision")
    parser.add_argument("--deck", type=str, default="rws", help="Target deck style (rws, thoth, marseille)")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch_size", type=int, default=4)

    args = parser.parse_args()
    train(args)
