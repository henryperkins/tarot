# Techniques for Teaching AI to Understand Tarot Deck Subtleties and Artistic Styles

## Overview

Teaching AI to understand and incorporate the subtleties of different tarot decks and artistic styles requires a multifaceted approach combining computer vision, natural language processing, generative models, and specialized training techniques. This comprehensive guide documents proven methodologies based on current research and practical implementations.

***

## Priority: Techniques Not Yet Utilized in This Repo

Focus these gaps before expanding the in-use stack; they are not currently implemented here.

- Generative deck creation (StyleGAN or diffusion) and prompt-to-image workflows are not present; the repo focuses on recognition and interpretation.
- Dedicated style classifier/authenticity checks (ResNet/ViT, edge detection pipelines) beyond CLIP similarity are not present.
- Trained object detection datasets (COCO/YOLO/Pascal VOC) and fine-tuned detectors are not present; symbol detection is zero-shot OWL-ViT with curated prompts.
- Multi-view/contrastive training across decks for style-invariant semantics is not present beyond aliasing and prompt cues.
- Probabilistic reasoning layers (Bayesian networks, beam search interpretation scoring, GNNs over the knowledge graph) are not present; current logic is rule-based + retrieval.
- External knowledge ingestion for RAG (imported corpora with citation tracking) is not present; the knowledge base is curated and internal.
- Generative quality metrics (FID/style-consistency) are not integrated into the evaluation scripts.

### Backlog (priority order)

1. Add a generative deck pipeline (diffusion or StyleGAN) with consistent frames, multi-pass curation, and style LoRA support.
2. Build an annotation and training workflow for symbol detection (COCO/YOLO), then integrate a fine-tuned detector into `shared/vision/symbolDetector.js`.
3. Implement a dedicated deck style classifier (ResNet/ViT) and plug it into vision proofing for style verification.
4. Extend GraphRAG with external knowledge ingestion + vector store and citation provenance.
5. Add a probabilistic interpretation layer (Bayesian weighting or beam search) that uses spread positions and card relations.
6. Introduce multi-view/contrastive training across decks to improve style-invariant recognition.
7. Add generative quality metrics (FID/style-consistency) and hook them into the evaluation scripts.

## 1. Data Collection and Curation

**Dataset Creation**

The foundation of any AI tarot system begins with comprehensive data collection. Successful implementations typically require 700 to 5,770+ tarot card images from diverse sources. Key practices include:[1][2][3]

- Collecting images from multiple deck types to capture stylistic diversity
- Oversampling Major Arcana cards to improve generation quality, as these archetypal cards require more representation
- Standardizing image dimensions (commonly 512x512 pixels or 350x600 pixels for card proportions)[4]
- Creating metadata-rich datasets that include card names, traditional meanings, positions, and orientation states (upright/reversed)

**Understanding Deck Diversity**

Different tarot traditions embody distinct symbolic systems and artistic philosophies. The three major traditions are:[5][6][7]

**Rider-Waite-Smith (RWS)**: Features fully illustrated Minor Arcana cards with rich symbolic imagery, incorporating Golden Dawn esoteric symbolism. Justice is numbered as card 11, and Strength as card 8.[6][7]

**Tarot de Marseille**: Uses a pip system for Minor Arcana (simple suit symbol arrangements), requiring more intuitive interpretation based on numerology and elemental associations. Justice is numbered as card 8, and the imagery is more minimalist with strong directional cues.[7][6]

**Thoth Tarot**: Created by Aleister Crowley and Lady Frieda Harris, this deck incorporates heavy esoteric symbolism from alchemy, astrology, and Kabbalah. Cards have unique names (e.g., "Adjustment" for Justice, "Aeon" for Judgement) and abstract, symbolic Minor Arcana.[5][7]

**Available Public Datasets**

Several curated datasets facilitate AI training:[3][8][4]
- GitHub tarot-json dataset: 78 RWS cards at 350x600px with structured JSON metadata
- Hugging Face tarot datasets: 5,770 ChatGPT-generated readings with card combinations and interpretations
- Roboflow Universe: 78 annotated tarot cards formatted for object detection training
- Kaggle tarot datasets: Overview datasets with Major and Minor Arcana descriptions

***

## 2. Computer Vision Techniques

**Style Recognition and Analysis**

Computer vision enables AI to recognize and differentiate artistic styles across decks. Advanced techniques include:[9][10]

**Convolutional Neural Networks (CNNs)** analyze artistic features and convert them into vector representations using Gram matrices, which capture style-specific patterns. **Edge detection operators** (Canny, Sobel, Laplacian, Scharr) help identify structural elements and authentication markers that distinguish genuine deck styles from imitations.[9]

**Deep transfer learning** using pre-trained models like ResNet50 allows extraction of high-level features from tarot imagery, enabling style classification and authentication. This approach has proven successful in analyzing and authenticating classical paintings, and applies equally well to tarot artwork.[9]

**Image Classification for Symbolic Elements**

Training object detection models to identify specific card elements enables AI to understand symbolic composition:[8][11]
- Recognizing figures, clothing, facial expressions, and gestures
- Identifying color patterns and their symbolic meanings
- Detecting background elements (landscapes, architecture, celestial objects)
- Classifying suits and numerical indicators

These classification systems can be trained using YOLO, COCO JSON, or Pascal VOC annotation formats, making them compatible with standard computer vision pipelines.[11]

***

## 3. Generative AI Models

**StyleGAN Approaches**

StyleGAN2 and StyleGAN2-ADA represent the state-of-the-art for generating high-quality tarot card imagery. The process involves:[12][13][14][1]

**Training methodology**: Collect 700+ images and train models through multiple iterations, generating 20-40 variations per card and curating approximately 2,000 total images down to final selections. This extensive generation-and-curation process ensures high quality.[15][1]

**Transfer learning**: Leverage pre-trained StyleGAN2 models as starting points, significantly reducing training time and data requirements. Pre-trained features transfer effectively to tarot illustration domains despite their fantastical nature.[13][14]

**Progressive growing**: Gradually increase output resolution during training to maintain stability and coherence in generated images. This technique prevents the common artifacts that plague direct high-resolution generation.[16]

**Prompt Engineering**

Effective prompt crafting is crucial for consistent, high-quality generation:[17][18][19]

- Craft precise descriptive prompts specifying card symbolism, traditional meanings, and visual elements
- Include style specifications (Art Nouveau, Gothic, Celestial, Steampunk, Watercolor, etc.)[20][21]
- Reference specific deck traditions (e.g., "Rider-Waite style High Priestess with flowing robes and serene expression, Art Nouveau background")[17]
- Iterate prompts to balance AI creativity with traditional deck consistency[18][12]
- Use trigger words to activate trained style LoRAs (e.g., "Tarot card" as model activation phrase)[22]

**Consistency Techniques**

Maintaining visual coherence across a 78-card deck requires specific strategies:[19][23][17]

- Design a consistent frame and border system applied to all generated cards
- Employ multi-image fusion capabilities to ensure character and style consistency across multiple cards[17]
- Use reference images from historical tarot decks to guide style transfer
- Apply progressive refinement, generating multiple candidates and selecting those that best match the established aesthetic[15]

***

## 4. Fine-Tuning Methods

**LoRA (Low-Rank Adaptation)**

LoRA has emerged as the most efficient fine-tuning technique for tarot style customization. Key advantages include:[24][25][26]

**Efficiency**: LoRA models are only 50-200MB compared to 4.5GB full model fine-tunes, making them practical for multiple style variations. Training requires just 20-50 images for character consistency or 50-200 images for complete style adaptation.[25]

**Flexibility**: Multiple LoRAs can be applied simultaneously at runtime, allowing creative mixing of styles, deck traditions, and thematic elements. This enables generating a card in "Rider-Waite structure with Art Nouveau styling and cyberpunk elements" by combining three separate LoRAs.[24][25]

**Technical parameters**: The rank parameter (typically 32-64) controls the expressiveness-efficiency tradeoff, while the alpha scaling factor stabilizes training when using small ranks. Higher ranks provide more expressive power but increase model size and training time.[24]

**Training Strategies**

Effective fine-tuning requires careful hyperparameter management:[27][28][29]

**Layer freezing**: Freeze early layers that capture general visual features while training later layers on tarot-specific patterns. This prevents catastrophic forgetting where the model loses its ability to generate coherent images.[29]

**Learning rate adjustment**: Use smaller learning rates (typically 10-100x smaller) than the pre-training phase to enable gradual adaptation without destabilizing the model.[29]

**Progressive unfreezing**: Gradually unfreeze layers during training, starting from the top (most specific) layers and working backward. This technique balances adaptation with preservation of learned features.[29]

**Regularization**: Apply dropout, weight decay, and data augmentation to prevent overfitting on limited tarot training sets.[29]

**Style Transfer Applications**

Style transfer enables applying the visual characteristics of one deck or artistic movement to tarot card generation:[27][17]

- Reference historical tarot illustrations to maintain authentic period aesthetics
- Enable runtime style application without complete model retraining
- Preserve deck-specific visual languages (color palettes, line work, compositional structures) across all 78 cards
- Create "style DNA" that can be injected into base models for personalized deck creation[24]

***

## 5. Natural Language Processing

**Interpretation Models**

AI tarot reading systems use sophisticated NLP to generate contextual interpretations:[30][31][32]

**Foundation models**: Fine-tune GPT-2, GPT-3, or GPT-4 on comprehensive tarot knowledge databases containing traditional card meanings for both upright and reversed positions. These databases should include centuries of accumulated tarot wisdom, symbolic associations, astrological correspondences, and numerological significance.[33][30]

**Training architecture**: Use Recurrent Neural Networks (RNNs) or advanced Transformer models with attention mechanisms to recognize patterns and generate interpretations relevant to specific queries. The attention mechanism enables the model to weight different cards' importance based on their positions and relationships.[32][30]

**Knowledge depth**: Train on multidimensional information including traditional meanings, symbolic associations, astrological links, elemental correspondences, and Kabbalistic connections. This comprehensive knowledge base enables nuanced interpretations that consider multiple symbolic layers.[30][32]

**Context Awareness**

Advanced AI tarot systems implement sophisticated context understanding:[34][35][36]

**Semantic analysis**: Natural Language Processing analyzes user questions to understand keywords, context, sentiment, and core inquiry intent. This allows the system to differentiate between questions about new romance versus career changes, even when phrased similarly.[34][30]

**Entity recognition**: Identify key entities (people, events, emotions, time periods) in questions to better match relevant card meanings and generate appropriate interpretations.[32][34]

**Sentiment analysis**: Analyze the emotional tone of queries to adjust interpretation tone and content, making readings feel more personalized and empathetic.[32][34]

**Conversation memory**: Implement memory systems that reference previous interactions, enabling the AI to provide continuity across multiple readings and track the evolution of a user's questions over time.[35][34]

**Knowledge Integration**

Structured knowledge representation enhances interpretation quality:[37][32]

**Knowledge graphs**: Build complex graphs containing multidimensional card information, relationships between cards, and archetypal connections. Graph Neural Networks (GNNs) reason over these structures to generate coherent, insightful interpretations.[37][32]

**Network topology**: Research shows tarot's major arcana has a specific community structure with three distinct topic clusters that are densely interconnected. Understanding this topology helps AI navigate card meanings efficiently. Readings starting from certain cards naturally traverse multiple thematic communities in just a few steps.[37]

**Probabilistic models**: Bayesian networks represent relationships and conditional probabilities between cards, calculating the most likely interpretation paths based on drawn combinations. This simulates the intuitive reasoning process of experienced human readers.[32]

***

## 6. Multimodal Learning

**Visual-Semantic Embedding**

Multimodal learning bridges the gap between visual tarot imagery and semantic meaning:[38][39][32]

**Unified embedding space**: Combine text and image information into shared high-dimensional vector spaces where visual features and semantic meanings coexist. This enables the AI to understand that a card's visual symbols correspond to specific divinatory meanings.[39][38]

**Attention mechanisms**: Weight the importance of different cards based on their positions in spreads (past/present/future, challenge/advice, etc.). Transformer architectures excel at this positional understanding.[40][32]

**Cross-modal training**: Train models on card-meaning pairs so visual recognition automatically activates associated symbolic interpretations. This simulates how human readers develop instant recognition of card significance.[32]

**Embedding Techniques**

Advanced embedding strategies enable sophisticated symbolic reasoning:[39]

**High-dimensional vectors**: Generate 1,000+ dimensional embedding vectors for each card, encoding various properties like elemental associations, archetypal themes, emotional valences, and narrative positions.[40][39]

**Archetype-based directions**: Create "archetype direction" tensors in embedding space representing major tarot themes (The Fool's journey, High Priestess wisdom, Empress fertility, etc.). Words and concepts can be projected along these directions to explore how meanings "mutate" in alignment with specific archetypes.[39]

**Semantic clustering**: Use cosine similarity and clustering algorithms to group related cards and interpretations, revealing the model's learned ontologies and how they align with traditional tarot wisdom.[2][39]

**Cross-Modal Understanding**

Effective multimodal systems implement sophisticated training strategies:[41][38]

**Multi-view learning**: Explicitly model intra-class variations. Different artistic representations of the same card improve generalization across diverse decks.[38]

**Unified loss functions**: Incorporate triplet loss and contrastive loss into unified frameworks that can be extended to multi-view learning, enabling models to understand that different visual styles represent the same underlying card meaning.[38]

**Retrieval-Augmented Generation (RAG)**: When generating interpretations, retrieve relevant card meanings from knowledge bases and synthesize them into coherent, narrative-style readings that connect meanings to the user's specific question.[36][35]

***

## 7. Deck-Specific Training

**Tradition-Specific Adaptations**

Each major tarot tradition requires specialized training approaches:[6][7][5]

**Rider-Waite-Smith adaptation**: Focus on fully illustrated scenes in Minor Arcana, emphasizing the rich symbolic details in each card's imagery. Train on Golden Dawn esoteric correspondences, recognizing that Justice is numbered 11 and Strength is 8 due to astrological alignment.[6]

**Marseille adaptation**: Emphasize numerological and elemental pattern recognition for pip cards that lack illustrated scenes. Train on more formulaic, structural interpretation methods. Recognize that Justice is traditionally numbered 8 in this system.[5][6]

**Thoth adaptation**: Incorporate heavy esoteric symbolism from alchemy, astrology, and Kabbalah. Train on renamed cards (Adjustment, Aeon) and abstract symbolic representations in the Minor Arcana. Understand Crowley's unique philosophical framework.[7][5]

**Custom Deck Creation**

LoRA fine-tuning enables rapid creation of custom themed decks:[22][25]

- Train specialized LoRAs on as few as 17 high-resolution images per theme
- Create thematic variations (environmental themes, fitness concepts, intellectual niches, cultural traditions)[42]
- Apply consistent color schemes and design frameworks across all 78 cards
- Enable runtime switching between multiple deck styles for comparison readings[43]

**Adaptation Strategies**

Handling deck diversity requires flexible architectural approaches:[44][43]

**Separate training subsets**: Create distinct training sets for each major tradition, allowing the model to learn tradition-specific visual vocabularies and symbolic systems.[14][13]

**Variation modeling**: Train models to recognize that the same card can have significantly different visual representations while maintaining core meanings. For example, Justice might show blonde or dark-haired figures, different colored pillars, yellow or white backgrounds, yet all represent the same archetype.[43][44]

**Flexible interpretation**: Build systems that can recognize and work with numbering variations, renamed cards, and different symbolic emphasis across traditions.[43][6]

***

## 8. Annotation and Labeling

**Symbolism Annotation**

Comprehensive annotation captures the rich symbolic language of tarot:[45][46]

**Element labeling**: Tag recurring symbols including elemental markers (fire triangles, water symbols), colors (red for passion, blue for spirituality), creatures (lions for strength, dogs for loyalty), and vegetation (roses for passion, lilies for innocence).[45]

**Directional cues**: Annotate figure orientations, gaze directions, and object pointing (sword direction, staff orientation) as these influence reading interpretations.[43]

**Metaphorical content**: Label emotional and metaphorical elements beyond literal object recognition, capturing the symbolic depth that makes tarot meaningful.[47]

**Semantic annotation**: Provide rich contextual metadata beyond simple tags, enabling deeper understanding of symbolic relationships.[48]

**Structured Labeling Practices**

Professional annotation follows computer vision best practices:[49][50]

**Label every occurrence**: Object detection models learn from pattern recognition, so every instance of important symbols must be labeled consistently. Skipping labels creates false negatives that hurt performance.[49]

**Multiple format support**: Use industry-standard formats like COCO JSON, YOLO (various versions), Pascal VOC XML, and TFRecord to ensure compatibility with diverse training pipelines.[11]

**Positive and negative examples**: Provide clear examples of correct labeling and also show what should not be labeled, establishing clear boundaries for annotation teams.[49]

**Annotation granularity**: Include attributes for finer distinctions (e.g., labeling a helmet as "yellow helmet" within the broader "helmet" class).[49]

**Quality Control**

Maintaining annotation consistency requires systematic processes:[48][49]

- Establish comprehensive annotation guidelines with visual examples
- Create source-of-truth reference sets showing correctly annotated images
- Document edge cases and exceptions specific to tarot symbolism
- Provide unannotated test images to verify labeler understanding
- Implement review processes to catch inconsistencies across large datasets

***

## 9. Reading Context Integration

**Spread Position Analysis**

Understanding card positions is crucial for meaningful interpretations:[51][52]

**Attention mechanisms**: Implement neural attention layers that weight the importance of different cards based on their positions in spreads. The same card means different things in "past" versus "future" positions.[40]

**Common spread recognition**: Train models to recognize standard layouts like three-card (past/present/future), Celtic Cross, relationship dynamics, and career guidance spreads.[53][51]

**Positional semantics**: Encode position-specific meanings into the model. For example, understanding that the "challenge" position highlights obstacles while the "advice" position suggests solutions.[53]

**Relational modeling**: Capture how cards influence each other based on proximity and position. Adjacent cards modify each other's meanings through "combination logic."[47]

**Contextual Interpretation Systems**

Modern AI tarot platforms implement sophisticated contextual understanding:[35][34]

**Function calling architecture**: Use OpenAI-style function calling where the AI decides when to invoke tarot tools (card drawing, spread creation) versus maintaining casual conversation. This prevents inappropriate reading attempts during simple chat.[34]

**Intent detection**: Employ natural language understanding to distinguish requests for spiritual guidance from casual conversation, triggering tarot operations only when appropriate.[52][34]

**Memory and continuity**: Maintain conversation history so the AI can reference previous readings, track recurring themes, and provide evolving guidance as situations develop.[35][34]

**User context integration**: Consider the user's specific question, situation, emotional state, and reading history when generating interpretations.[36][34][35]

**Algorithmic Synthesis**

Advanced interpretation engines combine multiple AI techniques:[54][32]

**Question-card cross-referencing**: Match user questions with drawn cards by analyzing semantic relationships between the query and traditional card meanings.[54][30]

**Bayesian inference**: Calculate the most likely interpretation paths using probabilistic models that consider card combinations and positions.[32]

**Beam search optimization**: Explore multiple interpretation possibilities and select the optimal path that provides the most coherent, relevant reading.[32]

**Context encoding**: Use Transformer encoder layers to capture the full reading context. All cards, their positions, and the user's question are encoded before generating interpretations.[40]

***

## 10. Quality Evaluation

**Quantitative Metrics**

Objective measurements help track model performance:[55][13][27]

**Distribution quality**: Calculate Frechet Inception Distance (FID) scores to measure how closely generated cards match the distribution of real tarot imagery. Lower FID scores indicate better quality.[13][14]

**Generation speed**: Measure throughput. Advanced systems generate 100 images in 15 seconds, making iterative refinement practical.[42]

**Style consistency**: Evaluate whether all cards in a generated deck maintain cohesive artistic style using automated style similarity metrics.

**Interpolation quality**: Assess how smoothly the model transitions between different card styles or meanings in latent space.[16][13]

**Qualitative Assessment**

Human evaluation remains essential for symbolic accuracy:[23][56]

**Symbolic accuracy**: Expert tarot readers evaluate whether generated cards contain appropriate symbolism for their intended meanings and whether novel imagery maintains authentic connections to traditional interpretations.

**Interpretation relevance**: Users assess whether AI-generated readings provide meaningful, applicable insights versus generic statements.[57][58]

**Aesthetic comparison**: Compare generated decks against traditional deck standards, evaluating artistic quality, emotional impact, and usability for readings.[59][60]

**Practitioner usability**: Test with actual tarot readers to ensure generated decks and interpretations support genuine divination practices.[56]

**Iterative Improvement**

Continuous refinement is essential for high-quality results:[61][15]

**Multiple generations**: Generate 20-40 variations per card and curate approximately 2,000 total images down to 78-90 final selections. This extensive curation ensures only the highest-quality outputs are included.[1][15]

**A/B testing**: Compare different training approaches, prompt strategies, and model architectures to identify what produces the best results.

**Prompt refinement**: Iteratively adjust prompts based on output quality, learning which descriptive elements most effectively guide generation.[12][18]

**Dataset expansion**: Continuously add high-quality training examples, especially for underrepresented styles or deck types.[29]

***

## Implementation Recommendations

**For Visual Generation Projects**

1. Start with a curated dataset of 700+ tarot images representing multiple traditions[1]
2. Use StyleGAN2-ADA with transfer learning from pre-trained models[14][13]
3. Implement LoRA fine-tuning (50-200MB models) for style flexibility[25][24]
4. Generate 20-40 variations per card and curate down to best results[15]
5. Apply consistent framing and multi-image fusion for deck coherence[19][17]

**For Interpretation Systems**

1. Fine-tune GPT-3/GPT-4 on comprehensive tarot knowledge databases[30][36]
2. Implement context-aware NLP with sentiment analysis and entity recognition[34][32]
3. Build knowledge graphs capturing card relationships and meanings[37][32]
4. Use function calling architecture for appropriate reading triggers[34]
5. Maintain conversation memory for continuity across readings[35]

**For Multi-Deck Support**

1. Create separate training subsets for RWS, Marseille, and Thoth traditions[5][6]
2. Document numbering and naming variations across systems[7][43]
3. Train models to recognize multiple visual representations of each card[44][43]
4. Use LoRA for efficient style switching between deck types[26][25]
5. Implement flexible interpretation systems that adapt to tradition-specific meanings[6]

***

## Conclusion

Teaching AI to understand and incorporate tarot deck subtleties requires integrating computer vision, generative models, natural language processing, and multimodal learning. The most successful approaches combine StyleGAN-based visual generation with LoRA fine-tuning for efficiency, transformer-based NLP for contextual interpretation, and knowledge graphs for symbolic understanding. By carefully curating training data, implementing sophisticated attention mechanisms, and maintaining human oversight for quality evaluation, AI systems can successfully capture the rich artistic and symbolic diversity of tarot traditions while generating meaningful, contextually appropriate readings.

## Sources

[1] Tarot Card Generation with Machine Learning - Lynne Yun Design http://www.lynneyun.com/spring-20-synthetic-media/2020/3/11/tarot-card-generation-with-machine-learning
[2] scrapfishies/ai-generated-tarot: Designing tarot cards with ... - GitHub https://github.com/scrapfishies/ai-generated-tarot
[3] Dendory/tarot - Datasets at Hugging Face https://huggingface.co/datasets/Dendory/tarot
[4] metabismuth/tarot-json: tarot dataset in json, and cards - GitHub https://github.com/metabismuth/tarot-json
[5] RWS vs Thoth vs Marseille : r/tarot https://www.reddit.com/r/tarot/comments/1dhzhf7/rws_vs_thoth_vs_marseille/
[6] Differences Between the Rider-Waite and Marseille Tarot Decks https://angelorum.co/tarot/the-differences-between-the-rider-waite-and-marseille-tarot-decks/
[7] Tarot Deck Types: Rider Waite Smith vs. Marseille vs. Thoth https://labyrinthos.co/blogs/learn-tarot-with-labyrinthos-academy/tarot-deck-types-rider-waite-smith-vs-marseille-vs-thoth
[8] Tarot Cards Object Detection Dataset by mda - Roboflow Universe https://universe.roboflow.com/mda-3nug1/tarot-cards-wxtw6
[9] Deep transfer learning for visual analysis and attribution of paintings ... https://www.nature.com/articles/s40494-023-01094-0
[10] Transforming Artwork Analysis with Advanced Computer Vision ... https://www.omdena.com/blog/ai-in-artwork-analysis-with-computer-vision-techniques
[11] Version - Roboflow Universe https://universe.roboflow.com/smilebamtol-gmail-com/tarotcard_aug1/dataset/1
[12] Artist uses AI to design terrifying, faceless, Bosch-style tarot cards ... https://www.pcgamer.com/artist-uses-ai-to-design-terrifying-faceless-bosch-style-tarot-cards-you-okay-hun/
[13] Transfer Learning in GANs to Generate New Card Illustrations - ar5iv https://ar5iv.labs.arxiv.org/html/2205.14442
[14] Transfer Learning in GANs to Generate New Card Illustrations - arXiv https://arxiv.org/abs/2205.14442
[15] Post Mortem Tarot Deck - Blair Neal https://ablairneal.com/project/post-mortem-tarot
[16] Analyzing and Improving the Image Quality of StyleGAN https://openaccess.thecvf.com/content_CVPR_2020/html/Karras_Analyzing_and_Improving_the_Image_Quality_of_StyleGAN_CVPR_2020_paper.html
[17] Tarot Card Art Style: AI's Mystical Creations | ReelMind https://reelmind.ai/blog/tarot-card-art-style-ais-mystical-creations
[18] Tarot of the Everlasting Day - AI Generated Tarot https://www.wopc.co.uk/tarot/tarot-of-the-everlasting-day-ai-generated-tarot
[19] Step-by-Step Guide to Launching a Custom AI-Generated Tarot ... https://www.francescatabor.com/articles/2025/8/29/step-by-step-guide-to-launching-a-custom-ai-generated-tarot-deck-on-amazon
[20] AI Tarot Card Generator: Transform Photos into Mystical ... - CharGen https://char-gen.com/transform/tarot-card
[21] AI Tarot Card Generator - Create Unique Tarot Cards Online - Vheer https://vheer.com/tarot-card-generator
[22] Ton618 Tarot Cards Flux LoRA - Models - Dataloop https://dataloop.ai/library/model/prithivmlmods_ton618-tarot-cards-flux-lora/
[23] AI Generated Art + Tarot and Oracle Decks with AI - Benebell Wen https://benebellwen.com/2022/09/14/creating-tarot-and-oracle-decks-with-ai-generated-art/
[24] What is LoRA in Image Generation? Low-Rank Adaptation Explained https://artsmart.ai/blog/what-is-lora-in-image-generation/
[25] Fine-tuning with LoRA: create your own avatars and styles! - kix https://www.kix.in/2023/04/07/sd-lora-finetuning/
[26] derekl35/tarot-qlora-flux - Hugging Face https://huggingface.co/derekl35/tarot-qlora-flux
[27] Customizing AI Models for Unique Art Styles - PRO EDU https://proedu.com/blogs/photoshop-skills/customizing-ai-models-for-personalized-art-creation-tailoring-algorithms-to-individual-artistic-styles
[28] Fine-Tuning Gen-AI Models for Creative Production - Xerago https://www.xerago.com/insights/gen-ai-models-for-creative-production
[29] How to fine-tune a pre-trained model for Generative AI applications? https://www.leewayhertz.com/fine-tuning-pre-trained-models/
[30] Unlocking Instant Answers: An In-Depth Guide to AI Tarot Yes or No https://skywork.ai/skypage/en/Unlocking-Instant-Answers:-An-In-Depth-Guide-to-AI-Tarot-Yes-or-No/1975264260111003648
[31] Tarotap Deep Dive: The Future of AI Guidance and Yes or No Tarot https://skywork.ai/skypage/en/Tarotap-Deep-Dive-The-Future-of-AI-Guidance-and-Yes-or-No-Tarot/1972884916053667840
[32] Is AI Tarot Accurate? A Deep Analysis of AI Tarot in 2025 - Tarotap https://tarotap.com/en/blog/ai-tarot-accuracy
[33] OpenAI ChatGPT and Tarot Descriptions - PathandTarot https://pathandtarot.com/openai-chatgpt-and-tarot-descriptions/
[34] ArcanaAI: Building an AI-Powered Tarot Reading Service with ... https://blog.nguyenvanloc.com/blog/20250817-arcanaai
[35] TarotQA Unveiled: A Deep Dive into the Future of Free AI Tarot https://skywork.ai/skypage/en/TarotQA-Unveiled-A-Deep-Dive-into-the-Future-of-Free-AI-Tarot/1976527455369490432
[36] Unveiling Tarotia: An AI Insider's Guide to Digital Divination https://skywork.ai/skypage/en/tarotia-ai-digital-divination/1976810355742666752
[37] The Divination Network of Tarot - Nodus Labs https://noduslabs.com/cases/divination-network-tarot/
[38] Multi-view visual semantic embedding for cross-modal image-text ... https://www.sciencedirect.com/science/article/abs/pii/S0031320324008392
[39] Navigating LLM embedding spaces using archetype-based directions https://www.lesswrong.com/posts/QwsyNzdPeDWLrG9gC/navigating-llm-embedding-spaces-using-archetype-based
[40] Intuitive and Visual Guide to Transformers and ChatGPT https://photonlines.substack.com/p/intuitive-and-visual-guide-to-transformers
[41] Multimodal Visual-Semantic Representations Learning for Scene ... https://dl.acm.org/doi/10.1145/3646551
[42] AI Tarot Cards Generator | Create Magic Tarot Cards for a seconds https://bulkimagegeneration.com/AI-Tarot-Cards-Generator
[43] Understanding different images for the same card : r/tarot https://www.reddit.com/r/tarot/comments/1jfcgx7/understanding_different_images_for_the_same_card/
[44] Card imagery in alternative decks - The Tarot Forum https://www.thetarotforum.com/forums/topic/12389-card-imagery-in-alternative-decks/
[45] Symbolism - Truly Teach Me Tarot https://teachmetarot.com/part-1-minor-arcana/lesson-3/symbolism/
[46] Data Annotation for AI: A Complete Guide to Labeled Training Data https://www.digitalbricks.ai/blog-posts/data-annotation
[47] Making Connections Between Cards - Truly Teach Me Tarot https://teachmetarot.com/lesson-1/making-connections-between-cards/
[48] Your In-Depth Guide to Data Labeling https://www.ayadata.ai/your-in-depth-guide-to-data-labeling/
[49] Data Annotation for High-Performing Computer Vision Models https://blog.roboflow.com/data-annotation/
[50] Data Labeling: The Authoritative Guide - Scale AI https://scale.com/guides/data-labeling-annotation-guide
[51] Arcana AI Guide | Understanding Tarot Readings https://myarcana.app/tarot-guide
[52] Episode 3 of Artificially Enlightened is Ready! - My Little Magic Shop https://mylittlemagicshop.com/blogs/magical-words/episode-3-of-artificially-enlightened-is-ready
[53] Relationship Dynamics Tarot Spread for Honest Insight https://tarotwithgord.com/tarot-spread/relationship-dynamics/
[54] Unlocking Instant Answers: An In-Depth Guide to AI Tarot Yes or No https://skywork.ai/skypage/en/Unlocking%20Instant%20Answers:%20An%20In-Depth%20Guide%20to%20AI%20Tarot%20Yes%20or%20No/1975264260111003648
[55] StyleGAN-T: Unlocking the Power of GANs for Fast Large-Scale Text ... https://axelsauer.com/publication/stylegan-t/
[56] AI Art in Tarot - Tarot Decks - A Tarot Reader's Community https://www.thetarotforum.com/forums/topic/14228-ai-art-in-tarot/
[57] AI Tarot reading interpretation and card combinations - Tarot Journal https://tarotjournal.com/blog/ai-tarot-reading-and-tarot-card-combinations/
[58] AI and Tarot - Mary K. Greer's Tarot Blog https://marykgreer.com/category/ai-tarot/
[59] Expressive Range in Tarot Decks https://emshort.blog/2018/05/03/favorite-tarot-decks/
[60] Fool's Journey: Same Card, Different Decks | Autostraddle https://www.autostraddle.com/fools-journey-same-card-different-decks-381701/
[61] Spring '20 Synthetic Media - Lynne Yun Design http://www.lynneyun.com/spring-20-synthetic-media
[62] How to Use Tarot + AI to Strengthen Intuition in Strategic Planning https://anchorchange.substack.com/p/how-to-use-tarot-ai-to-strengthen
[63] [PDF] From Explainability to Ineffability? ML Tarot and the ... - Caitie Lustig https://caitie.io/wp-content/uploads/From_Explainability_to_Ineffability.pdf
[64] ChatGPT prompt for stellar readings, very beginner friendly : r/tarot https://www.reddit.com/r/tarot/comments/15f2mwb/chatgpt_prompt_for_stellar_readings_very_beginner/
[65] Can A.I. teach you how to read tarot? - Liz Worth's Tarot School https://www.lizworth.com/blog/can-a-i-teach-you-how-to-read-tarot
[66] Is anyone combining Tarot with AI? - Reddit https://www.reddit.com/r/tarot/comments/13xux9d/is_anyone_combining_tarot_with_ai/
[67] Understanding tarot cards requires learning their specific meanings ... https://www.facebook.com/groups/545789979118336/posts/863772543986743/
[68] AI-generated/designed tarot decks ... what are your thoughts? - Reddit https://www.reddit.com/r/TarotDecks/comments/x82gur/aigenerateddesigned_tarot_decks_what_are_your/
[69] Major Arcana tarot deck creation with AI - Facebook https://www.facebook.com/groups/officialmidjourney/posts/406545461637024/
[70] Using AI art generators in tarot deck creation - Facebook https://www.facebook.com/groups/aiartuniverse/posts/620998856332019/
[71] Machine learning "tarot" algorithm : r/learnmachinelearning https://www.reddit.com/r/learnmachinelearning/comments/wr39x7/machine_learning_tarot_algorithm/
[72] Tarot System Showdown! Marseille vs. Rider-Waite vs. Crowley Thoth https://www.youtube.com/watch?v=V-GS2ulxTRM
[73] [PDF] Exploring the "Magic" of Algorithmic Predictions with Technology ... https://www.ischool.berkeley.edu/sites/default/files/sproject_attachments/lee-popat-prakkamakul_mims-final-project-paper.pdf
[74] Minor Arcana - RWS, Marseilles and imagery. - Copperscene https://copperscene.com/2024/05/01/minor-arcana-rws-marseilles-and-imagery/
[75] Computer Vision for art specifically : r/computervision https://www.reddit.com/r/computervision/comments/vwd5ta/computer_vision_for_art_specifically/
[76] Introduction to Tarot Deck Collection and Waite/Smith Style Decks https://www.facebook.com/groups/751447628892819/posts/1445543742816534/
[77] Coding Interview Tarot: Predicting Your Technical Questions ... https://algocademy.com/blog/coding-interview-tarot-predicting-your-technical-questions-through-card-reading/
[78] Authentic Tarot Artwork and the Impact of AI-Generated Content https://www.facebook.com/groups/1457073457838971/posts/3606988346180794/
[79] Tarot Systems: a look at RWS and TdM - Amino Apps https://aminoapps.com/c/pagans-witches/page/blog/tarot-systems-a-look-at-rws-and-tdm-tarot/qkpL_lE4tRuBY0qB0Wlgj8qZkpKeL5mJZWa
[80] r/ChatGPT on Reddit: A prompt that generates a Tarot Card Reading ... https://www.reddit.com/r/ChatGPT/comments/112c5vj/a_prompt_that_generates_a_tarot_card_reading_with/
[81] How can I train an AI model to replicate my unique painting style ... https://www.reddit.com/r/AI_Agents/comments/1ky7tux/how_can_i_train_an_ai_model_to_replicate_my/
[82] The Neuroscience of Tarot: From Imagery to Intuition to Prediction https://books.google.com/books/about/The_Neuroscience_of_Tarot.html?id=BWMnEQAAQBAJ
[83] Fine-tuning Models for Creativity - by Paul Aaron - Addition https://addition.substack.com/p/finetuning-models-for-creativity
[84] The Best 25 Midjourney Prompts for Tarot Card - OpenArt https://openart.ai/blog/post/midjourney-prompts-for-tarot-card
[85] The Algorithm as Oracle When AI Meets Tarot, Astrology Digital ... https://honeysucklemag.com/ai-tarot-algorithmic-astrology-mystic-tech/
[86] Finetuning - AI for Art Educators https://aitoolkit.art/finetune
[87] How to create simple tarot cards using prompts? - Facebook https://www.facebook.com/groups/nightcafeaiart/posts/2488543121356194/
[88] Refining AI art with classical fine art style using SDXL - Facebook https://www.facebook.com/groups/aiartuniverse/posts/1283500553415176/
[89] Tarot-card Image Prompts - PromptDen https://promptden.com/inspiration/tarot-card+all
[90] Tech and Tarot-AI Throughout Time - NiaApps https://niaapps.github.io/niaapps-blog/updates-coding/2021/07/07/AI-Throughout-Time.html
[91] Fine tuning image generation models That See the Arab ... - ZAKA AI https://zaka.ai/fine-tuning-image-generation-models-zaka/
[92] Transfer of energy from old deck to new? - Tarot Forum https://www.tarotforum.net/threads/transfer-of-energy-from-old-deck-to-new.127902/
[93] How do I connect with a new tarot deck? I'm a first time learner. https://www.reddit.com/r/tarot/comments/1gxqy7n/how_do_i_connect_with_a_new_tarot_deck_im_a_first/
[94] How to Bond with a New Tarot Deck http://www.thetarotprofessor.com/how-to-bond-with-a-new-tarot-deck/
[95] AI Tarot Card Generator - Create Custom Tarot Cards - LightX https://www.lightxeditor.com/photo-editing/ai-tarot-card-generator/
[96] 8 Ways to Connect to a New Tarot Deck - YouTube https://www.youtube.com/watch?v=sSbeFHc8ykg
[97] Bonding with Your New Tarot Deck - YouTube https://www.youtube.com/watch?v=x8IeGqiQiL8
[98] AI Tarot Card Generator | Make Personalized Tarot Art Fast - getimg.ai https://getimg.ai/use-cases/ai-tarot-card-generator
[99] Just got new tarot cards how do I transfer my energy in them I've ... https://www.facebook.com/groups/pleaseimawitch/posts/1246480417061839/
[100] The Best Text to Tarot Card AI Generator (for Free) - OpenArt https://openart.ai/generator/tarot-card
[101] Get to know your new deck with the Tarot Deck Interview Spread https://littleredtarot.com/tarot-deck-interview-spread/
[102] [PDF] A Meta-Learned Self-Supervised Approach for Trajectory Prediction https://openaccess.thecvf.com/content/ICCV2023/papers/Pourkeshavarz_Learn_TAROT_with_MENTOR_A_Meta-Learned_Self-Supervised_Approach_for_Trajectory_ICCV_2023_paper.pdf
[103] 3D Graph of Tarot Concepts - Reddit https://www.reddit.com/r/tarot/comments/1deczox/3d_graph_of_tarot_concepts/
[104] TAROT: Targeted Data Selection via Optimal Transport - arXiv https://arxiv.org/html/2412.00420v1
[105] TAROT: Targeted Data Selection via Optimal Transport - arXiv https://arxiv.org/html/2412.00420v2
[106] Analyzing and finetuning a Lora #1093 - GitHub https://github.com/vladmandic/automatic/discussions/1093
[107] Astrology and Tarot Correspondences: The Minor Arcana Pip Cards https://labyrinthos.co/blogs/learn-tarot-with-labyrinthos-academy/astrology-and-tarot-correspondences-the-minor-arcana-pip-cards
[108] Unifying Visual-Semantic Embeddings with Multimodal Neural ... https://ui.adsabs.harvard.edu/abs/2014arXiv1411.2539K/abstract
[109] InfraNodus: AI Text Analysis and Insight Tool for Research and ... https://infranodus.com
[110] Image Artistic Style fine-tuning. is Unsloth VLM the right tool ... - Reddit https://www.reddit.com/r/unsloth/comments/1oq4ly6/image_artistic_style_finetuning_is_unsloth_vlm/
[111] [PDF] Pattern Recognition https://eprints.bournemouth.ac.uk/40889/1/Improving%20visual-semantic%20embeddings%20by%20learning%20semantically-enhanced%20hard%20negatives%20for%20cross-modal%20information%20retrieval.pdf
[112] The Game Begins: AIs Interpret the Triadic Tarots https://kizziah.blog/the-game-begins-ais-interpret-the-triadic-tarots/

## Implemented Here

This appendix maps the techniques above to their concrete implementation in this repository.

### Vision and Style Recognition
- CLIP tarot vision pipeline: [shared/vision/tarotVisionPipeline.js](../shared/vision/tarotVisionPipeline.js)
- Llama vision backend: [shared/vision/llamaVisionPipeline.js](../shared/vision/llamaVisionPipeline.js)
- Vision backend registry: [shared/vision/visionBackends.js](../shared/vision/visionBackends.js)
- Vision proof API (server verification): [functions/api/vision-proof.js](../functions/api/vision-proof.js)
- Symbol detection (OWL-ViT) + heatmaps: [shared/vision/symbolDetector.js](../shared/vision/symbolDetector.js)
- Symbol annotations + Minor Arcana lexicon: [shared/symbols/symbolAnnotations.js](../shared/symbols/symbolAnnotations.js), [shared/vision/minorSymbolLexicon.js](../shared/vision/minorSymbolLexicon.js)
- Visual tone/emotion profiling: [shared/vision/visualSemantics.js](../shared/vision/visualSemantics.js)

### Deck-Specific Adaptation
- Deck profiles and prompt cues: [shared/vision/deckProfiles.js](../shared/vision/deckProfiles.js)
- Deck aliases and image mapping: [shared/vision/deckAssets.js](../shared/vision/deckAssets.js)
- Deck overrides for knowledge graph: [src/data/knowledgeGraphData.js](../src/data/knowledgeGraphData.js)
- Core card datasets: [src/data/majorArcana.js](../src/data/majorArcana.js), [src/data/minorArcana.js](../src/data/minorArcana.js)
- Public deck images: [public/images/cards/](../public/images/cards/)

### LoRA and Fine-Tuned Prototypes
- Adapter weights (RWS/Thoth/Marseille): [models/adapters/rws/adapter_model.safetensors](../models/adapters/rws/adapter_model.safetensors), [models/adapters/thoth/adapter_model.safetensors](../models/adapters/thoth/adapter_model.safetensors), [models/adapters/marseille/adapter_model.safetensors](../models/adapters/marseille/adapter_model.safetensors)
- Prototype embeddings (per deck): [data/vision/fine-tuned/prototypes.json](../data/vision/fine-tuned/prototypes.json)
- Prototype loader: [shared/vision/fineTuneCache.js](../shared/vision/fineTuneCache.js)

### Interpretation and Contextual Reasoning
- Spread analysis + elemental dignities: [functions/lib/spreadAnalysis.js](../functions/lib/spreadAnalysis.js)
- Spread position weighting: [functions/lib/positionWeights.js](../functions/lib/positionWeights.js)
- Knowledge graph patterns: [functions/lib/knowledgeGraph.js](../functions/lib/knowledgeGraph.js), [docs/knowledge-graph/README.md](../docs/knowledge-graph/README.md)
- GraphRAG retrieval + embeddings: [functions/lib/graphRAG.js](../functions/lib/graphRAG.js), [functions/lib/knowledgeBase.js](../functions/lib/knowledgeBase.js), [functions/lib/embeddings.js](../functions/lib/embeddings.js)
- Prompt assembly: [functions/lib/narrativeBackends.js](../functions/lib/narrativeBackends.js), [functions/lib/narrative/prompts/](../functions/lib/narrative/prompts/)

### NLP Context, Memory, Personalization
- Context detection: [functions/lib/contextDetection.js](../functions/lib/contextDetection.js)
- Memory storage: [functions/lib/userMemory.js](../functions/lib/userMemory.js)
- Follow-up prompts with memory: [functions/api/reading-followup.js](../functions/api/reading-followup.js), [functions/lib/followUpPrompt.js](../functions/lib/followUpPrompt.js)
- Personalization storage + styling: [src/contexts/PreferencesContext.jsx](../src/contexts/PreferencesContext.jsx), [src/utils/personalizationStorage.js](../src/utils/personalizationStorage.js), [functions/lib/narrative/styleHelpers.js](../functions/lib/narrative/styleHelpers.js)

### Evaluation and Quality Gates
- Evaluation system docs: [docs/evaluation-system.md](../docs/evaluation-system.md)
- Evaluation pipeline: [functions/lib/evaluation.js](../functions/lib/evaluation.js), [functions/lib/readingQuality.js](../functions/lib/readingQuality.js)
- Vision evaluation scripts: [scripts/evaluation/runVisionConfidence.js](../scripts/evaluation/runVisionConfidence.js), [scripts/evaluation/computeVisionMetrics.js](../scripts/evaluation/computeVisionMetrics.js), [scripts/evaluation/processVisionReviews.js](../scripts/evaluation/processVisionReviews.js)
- Narrative evaluation scripts: [scripts/evaluation/runNarrativeSamples.js](../scripts/evaluation/runNarrativeSamples.js), [scripts/evaluation/verifyNarrativeGate.js](../scripts/evaluation/verifyNarrativeGate.js)
- Stored eval outputs: [data/evaluations/](../data/evaluations/)
