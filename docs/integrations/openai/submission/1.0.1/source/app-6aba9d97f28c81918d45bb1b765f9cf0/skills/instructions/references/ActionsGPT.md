---
title: "ActionsGPT"
source: "Private source conversation link omitted from this public upload copy on 2026-10-01; preserved in the original archive."
author:
published:
created: 2026-05-23
description: "Helps you create OpenAPI specifications from documentation, code examples, cURL commands, or just a description of how to use an API."
tags:
  - "clippings"
---
> Historical design discussion, preserved as background. Current live tool schemas and [actions-contract.md](actions-contract.md) take precedence over every endpoint, field, authentication, and retry example below. The supplied [Action schema](migration-source/tarot-actions-complete.yaml) is also historical; it does not configure a connection. See [capabilities-audit.md](capabilities-audit.md) for current evidence; [migration-audit.md](migration-audit.md) records earlier findings.

How to utilize my tarot reading app in a gpt?

You can connect your tarot app to a custom GPT if your app has, or can expose, an HTTPS API that the GPT can call. The cleanest setup is one “create reading” endpoint that accepts the user’s question/spread and returns cards plus interpretation.

To use your tarot reading app inside a custom GPT, expose your app through an HTTPS API, then add that API as a GPT Action.

Your GPT can then do things like:

“Give me a three-card reading about my career.”

The GPT would call your app’s API, receive the cards and interpretation, then present the result conversationally.

Paste and adapt this starter OpenAPI spec in your GPT’s **Actions** section:

```markdown
openapi: 3.1.0
info:
  title: Tarot Reading API
  description: API for connecting a tarot reading app to a custom GPT.
  version: 1.0.0

servers:
  - url: https://api.your-tarot-app.com/v1
    description: Production server

security:
  - bearerAuth: []

paths:
  /spreads:
    get:
      operationId: getSpreads
      summary: Get available tarot spreads.
      description: Returns the tarot spreads supported by the app.
      responses:
        "200":
          description: A list of available tarot spreads.
          content:
            application/json:
              schema:
                type: object
                properties:
                  spreads:
                    type: array
                    items:
                      $ref: "#/components/schemas/Spread"
        "401":
          description: Unauthorized.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /decks:
    get:
      operationId: getDecks
      summary: Get available tarot decks.
      description: Returns tarot decks available in the app.
      responses:
        "200":
          description: A list of available tarot decks.
          content:
            application/json:
              schema:
                type: object
                properties:
                  decks:
                    type: array
                    items:
                      $ref: "#/components/schemas/Deck"
        "401":
          description: Unauthorized.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /readings:
    post:
      operationId: createReading
      summary: Create a tarot reading.
      description: Creates a tarot reading based on the user question, spread, and optional deck.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateReadingRequest"
      responses:
        "200":
          description: Tarot reading created successfully.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Reading"
        "400":
          description: Invalid request.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: API Key

  schemas:
    CreateReadingRequest:
      type: object
      required:
        - question
        - spread
      properties:
        question:
          type: string
          description: The user's question or topic for the tarot reading.
          example: "What should I know about my career path?"
        spread:
          type: string
          description: The tarot spread to use.
          example: "threeCard"
        deckId:
          type: string
          description: Optional ID of the tarot deck to use.
          example: "rider-waite"
        cardCount:
          type: integer
          description: Number of cards to draw, mainly for custom spreads.
          minimum: 1
          maximum: 10
          example: 3
        includeReversed:
          type: boolean
          description: Whether reversed cards may appear.
          default: true
        userContext:
          type: string
          description: Optional additional context from the user.
          example: "I am considering changing jobs soon."

    Reading:
      type: object
      required:
        - id
        - question
        - spread
        - cards
        - interpretation
      properties:
        id:
          type: string
          example: "reading_12345"
        question:
          type: string
          example: "What should I know about my career path?"
        spread:
          type: string
          example: "threeCard"
        cards:
          type: array
          items:
            $ref: "#/components/schemas/CardPull"
        interpretation:
          $ref: "#/components/schemas/ReadingInterpretation"
        createdAt:
          type: string
          format: date-time
          example: "2026-05-23T12:00:00Z"

    CardPull:
      type: object
      required:
        - name
        - orientation
        - positionName
      properties:
        cardId:
          type: string
          example: "major_00"
        name:
          type: string
          example: "The Fool"
        arcana:
          type: string
          enum:
            - major
            - minor
          example: "major"
        suit:
          type: string
          example: "Cups"
        number:
          type: string
          example: "0"
        orientation:
          type: string
          enum:
            - upright
            - reversed
          example: "upright"
        keywords:
          type: array
          items:
            type: string
          example:
            - beginnings
            - spontaneity
            - trust
        imageUrl:
          type: string
          format: uri
          example: "https://api.your-tarot-app.com/images/the-fool.jpg"
        positionName:
          type: string
          example: "Past"
        positionMeaning:
          type: string
          example: "Influences from the past affecting the situation."

    ReadingInterpretation:
      type: object
      required:
        - summary
        - positions
      properties:
        summary:
          type: string
          example: "This reading suggests a period of transition and opportunity."
        positions:
          type: array
          items:
            $ref: "#/components/schemas/PositionInterpretation"
        advice:
          type: string
          example: "Stay open to new possibilities, but avoid rushing important decisions."

    PositionInterpretation:
      type: object
      required:
        - positionName
        - cardName
        - meaning
      properties:
        positionName:
          type: string
          example: "Past"
        cardName:
          type: string
          example: "The Fool"
        meaning:
          type: string
          example: "You may be coming from a time of experimentation or a leap of faith."

    Spread:
      type: object
      required:
        - id
        - name
        - cardCount
      properties:
        id:
          type: string
          example: "threeCard"
        name:
          type: string
          example: "Three Card Spread"
        cardCount:
          type: integer
          example: 3
        positions:
          type: array
          items:
            type: string
          example:
            - Past
            - Present
            - Future

    Deck:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: string
          example: "rider-waite"
        name:
          type: string
          example: "Rider-Waite Tarot"
        description:
          type: string
          example: "Classic 78-card tarot deck."

    Error:
      type: object
      required:
        - message
      properties:
        code:
          type: string
          example: "invalid_request"
        message:
          type: string
          example: "The requested spread is not supported."
```

In your GPT instructions, add something like:

```markdown
When the user asks for a tarot reading, ask for their question if they have not provided one. Then call createReading using the selected spread. Present the returned cards, positions, and interpretation in a warm, reflective tone. Do not claim certainty about the future.
```

You’ll need to replace:

```markdown
https://api.your-tarot-app.com/v1
```

with your real API base URL. If your app does not have an API yet, create at least one backend endpoint like:

```markdown
POST /v1/readings
```

that accepts the user’s question and returns structured JSON with the cards and reading.

The backend in `henryperkins/tarot` already exposes a synchronous tarot–reading API (`POST /api/tarot‑reading`) and a set of job‑mode endpoints. To wire this backend into a custom GPT you do **not** need to change the worker code; instead you need to adjust your GPT’s Action definition and instructions so they match the app’s existing contract. In particular:

1. **Use the existing route**. The repository’s Cloudflare Worker maps the “synchronous reading” endpoint to `POST /api/tarot‑reading` [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L17-L25). Do not invent a new `/readings` path like in the earlier sample – use this path (and optionally the `/api/tarot‑reading/jobs` endpoints for async mode). Deploy your worker to a public HTTPS domain and put that domain under `servers:` in your OpenAPI schema.
2. **Reflect the expected request structure.** The function expects a JSON body with a `spreadInfo` object (with at least a `name`, and optionally a `key`) and a `cardsInfo` array; each card requires `position`, `card`, `orientation` and `meaning` fields [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L37-L83). You can also pass `userQuestion` and `reflectionsText` strings. Update the request schema in your OpenAPI file to use these fields exactly; the minimal starter provided in the repo’s guide shows the proper structure [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L37-L83). Do **not** use `question`, `spread`, `cardCount`, etc. as in the earlier generic example.
3. **Set the operation and authentication.** Name the operation `createTarotReading` (or similar) under the `/api/tarot‑reading` path [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L37-L83). In the GPT Actions settings, choose either “API Key” or “OAuth” authentication. The backend already accepts `Authorization: Bearer sk_…` headers [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L85-L89), so if you enable API‑Key auth you can pass that key in the bearer token.
4. **Update your GPT instructions.** The instructions should tell the GPT when to call `createTarotReading` and what data to collect. For example:
	- Tell the GPT that when a user asks for a tarot reading, it must ask for the spread name and the details of each card (position, card name, orientation and meaning) if those are missing.
		- Emphasise that it should not fabricate any fields; if the spread or card details are unknown, the GPT should ask follow‑up questions [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L91-L97).
		- After gathering the `spreadInfo` and `cardsInfo` (plus optional `userQuestion` and `reflectionsText`), call the `createTarotReading` action.
5. **(Optional) Add async job endpoints.** Once you have the synchronous call working, you can extend your OpenAPI file with the `/api/tarot‑reading/jobs*` operations (create job, check status, stream results, cancel job) [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L23-L27) to support long‑running readings. Each of these would be a separate operation in the same OpenAPI document.

In short, to integrate your tarot app into a custom GPT you **do not alter your existing code**; instead you adapt the OpenAPI schema and GPT instructions to mirror the backend’s `POST /api/tarot‑reading` contract [github.com](https://github.com/henryperkins/tarot/blob/master/docs/integrations/openai/chatgpt-gpt-actions-setup.md#L37-L83), supply authentication, and instruct the GPT to collect and pass the required fields.

Provide that

Below is a valid OpenAPI 3.1.0 specification for your tarot backend that matches the repository’s `POST /api/tarot-reading` contract and can be used in a custom GPT Action:

```markdown
openapi: 3.1.0
info:
  title: Tarot Reading API
  description: |
    An API for generating personalized tarot readings.  A reading is created
    by specifying a spread name (and optional key) and supplying an array of
    cards with their positions, orientations, and meanings.  The API returns a
    structured reading with narrative analysis and metadata.
  version: "1.0.0"
servers:
  - url: https://your-backend.example.com
    description: Production instance of the tarot reading service
paths:
  /api/tarot-reading:
    post:
      operationId: createTarotReading
      summary: Generate a personalized tarot reading
      description: |
        Creates a tarot reading synchronously.  The request body must include
        details of the spread and the cards drawn.  Optional fields allow a
        user question and reflections to be incorporated.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - spreadInfo
                - cardsInfo
              properties:
                spreadInfo:
                  type: object
                  description: Information about the spread being used.
                  required:
                    - name
                  properties:
                    name:
                      type: string
                      description: Display name of the spread (e.g. "Celtic Cross").
                    key:
                      type: string
                      description: Optional key or identifier for the spread.
                cardsInfo:
                  type: array
                  description: A list of cards in the order they appear in the spread.
                  minItems: 1
                  items:
                    type: object
                    required:
                      - position
                      - card
                      - orientation
                      - meaning
                    properties:
                      position:
                        type: string
                        description: Name of the position in the spread (e.g. "Past").
                      card:
                        type: string
                        description: The title of the card drawn (e.g. "The Fool").
                      orientation:
                        type: string
                        enum: [Upright, Reversed]
                        description: Whether the card is upright or reversed.
                      meaning:
                        type: string
                        description: The user’s interpretation or context for the card in that position.
                      number:
                        type: integer
                        nullable: true
                        description: Optional card number if known (0–21 for major arcana or 1–14 for minor arcana).
                      suit:
                        type: string
                        nullable: true
                        description: Optional suit for minor arcana cards.
                      rank:
                        type: string
                        nullable: true
                        description: Optional rank name for minor arcana cards.
                      rankValue:
                        type: integer
                        nullable: true
                        description: Optional rank value for minor arcana cards.
                userQuestion:
                  type: string
                  description: Optional question or topic posed by the user for the reading.
                reflectionsText:
                  type: string
                  description: Optional reflection or context provided by the user to enrich the reading.
                reversalFrameworkOverride:
                  type: string
                  description: Optional override for the reversal interpretation framework.
                deckStyle:
                  type: string
                  description: Optional identifier for the deck style (e.g. "rws-1909").
                personalization:
                  type: object
                  description: Optional personalization settings that influence narrative tone.
                  properties:
                    displayName:
                      type: string
                      description: User’s preferred name.
                    readingTone:
                      type: string
                      enum: [gentle, balanced, blunt]
                      description: Preferred tone of the reading narrative.
                    spiritualFrame:
                      type: string
                      enum: [psychological, spiritual, mixed, playful]
                      description: Preferred frame for spiritual or psychological emphasis.
                    tarotExperience:
                      type: string
                      enum: [newbie, intermediate, experienced]
                      description: User’s experience level with tarot.
                    preferredSpreadDepth:
                      type: string
                      enum: [short, standard, deep]
                      description: Preferred depth of narrative.
                    focusAreas:
                      type: array
                      items:
                        type: string
                      description: Specific life domains or themes for the reading.
                location:
                  type: object
                  description: Optional geolocation data (used only when a horoscope context is needed).
                  properties:
                    latitude:
                      type: number
                      minimum: -90
                      maximum: 90
                    longitude:
                      type: number
                      minimum: -180
                      maximum: 180
                    timezone:
                      type: string
                      description: IANA timezone name.
                    accuracy:
                      type: number
                      description: Optional GPS accuracy in meters.
                    source:
                      type: string
                      enum: [browser, manual]
                      description: How the location was provided.
                persistLocationToJournal:
                  type: boolean
                  description: Optional flag indicating whether to persist location with journal.
      responses:
        '200':
          description: A structured tarot reading
          content:
            application/json:
              schema:
                type: object
                required:
                  - reading
                  - provider
                  - requestId
                properties:
                  reading:
                    type: string
                    description: Generated narrative for the reading.
                  provider:
                    type: string
                    description: Narrative backend used (e.g. "local-composer", "openai-native", or "azure-gpt5").
                  requestId:
                    type: string
                    description: Unique request identifier.
                  themes:
                    type: object
                    description: Analysis of overarching themes detected in the spread.
                    nullable: true
                  reasoning:
                    type: object
                    description: Model reasoning metadata.
                    nullable: true
                  context:
                    type: object
                    description: Contextual inference applied to the reading.
                    nullable: true
                  visionInsights:
                    type: array
                    description: Vision-derived insights if card images were uploaded.
                    items:
                      type: object
                  narrativeMetrics:
                    type: object
                    description: Coverage and quality metrics for the narrative.
                    nullable: true
                  graphRAG:
                    type: object
                    description: Graph‑based retrieval‑augmented generation stats.
                    nullable: true
```

Replace `https://your-backend.example.com` in the `servers` block with the fully qualified domain of your deployed API. If you also wish to support asynchronous jobs, you can add additional paths for `/api/tarot-reading/jobs` and related endpoints; however the specification above is sufficient for the synchronous reading endpoint.

Since the worker is already deployed at `https://tarot.lakefrontdev.com`, you simply need to replace the placeholder server URL in your OpenAPI spec with this domain. Your existing path and schema definitions remain correct; only the `servers` block needs to be updated to point to the actual host:

```markdown
openapi: 3.1.0
info:
  title: Tarot Reading API
  version: "1.0.0"
  description: |
    An API for generating personalized tarot readings.
servers:
  - url: https://tarot.lakefrontdev.com
    description: Production instance of the tarot reading service
paths:
  /api/tarot-reading:
    post:
      operationId: createTarotReading
      summary: Generate a personalized tarot reading
      # requestBody and response schemas remain unchanged
      ...
```

With this change, your GPT Action will send requests to the correct domain (`tarot.lakefrontdev.com`) instead of the placeholder `your-backend.example.com`. No other modifications are necessary unless you also want to support the asynchronous job endpoints; in that case you can add definitions for `/api/tarot-reading/jobs` and related paths using the same base URL.
