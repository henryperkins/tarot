# Tableu iOS App

Native iOS companion app for [Tableu](https://tableu.app) — a thoughtful tarot reading experience built with SwiftUI.

## Overview

This iOS app provides a native mobile experience for Tableu's tarot reading platform, connecting to the existing Cloudflare Workers API backend. It features:

- 🎴 **Full tarot reading flow**: Spread selection, ritual, card drawing, and AI-generated narratives
- 📖 **Journal**: Save and review your past readings
- ♿ **Accessibility-first**: VoiceOver labels, Dynamic Type support, high contrast
- 🌗 **Dark mode**: Automatic system appearance support
- ✨ **Smooth animations**: Spring-based transitions and card flip effects
- 🔒 **Privacy-focused**: Minimal data collection, secure API communication

## Requirements

- **Xcode 15.0+**
- **iOS 17.0+**
- **Swift 5.9+**

## Architecture

### SwiftUI + Modern Concurrency

The app follows Apple's latest best practices:

```
ios/Tableu/
├── Tableu/
│   ├── TableuApp.swift          # Main app entry point
│   ├── Models/                  # Data models
│   │   ├── TarotCard.swift      # Card representation
│   │   ├── Spread.swift         # Spread configurations
│   │   └── Reading.swift        # Reading data model
│   ├── Services/                # Business logic layer
│   │   ├── APIClient.swift      # HTTP client
│   │   └── DeckService.swift    # Card drawing & shuffling
│   ├── ViewModels/              # State management
│   │   ├── ReadingViewModel.swift
│   │   └── JournalViewModel.swift
│   └── Views/                   # SwiftUI views
│       ├── ReadingFlowView.swift
│       ├── SpreadSelectionView.swift
│       ├── RitualView.swift
│       ├── CardRevealView.swift
│       ├── ReadingNarrativeView.swift
│       ├── JournalListView.swift
│       ├── JournalDetailView.swift
│       └── SettingsView.swift
```

### State Management

Uses SwiftUI's `@Observable` macro (iOS 17+) for reactive state management:

```swift
@Observable
class ReadingViewModel {
    var selectedSpread: Spread?
    var question: String = ""
    var drawnCards: [DrawnCard] = []
    var currentReading: Reading?
    var isGenerating = false
    // ...
}
```

### API Integration

The `APIClient` connects to the Tableu backend:

```swift
// Generate a reading
let response = try await APIClient.shared.generateReading(request: readingRequest)

// Fetch journal entries
let entries = try await APIClient.shared.fetchJournalEntries()

// Save a reading
try await APIClient.shared.saveReading(reading)
```

## Setup Instructions

### 1. Open in Xcode

```bash
cd ios/Tableu
open Tableu.xcodeproj
```

### 2. Configure API Endpoint

By default, the app points to `https://tableu.app`. To use a different endpoint:

1. Open `Services/APIClient.swift`
2. Modify the `baseURL` in the initializer
3. Or configure it at runtime in **Settings** tab

For local development:
```swift
init(baseURL: String = "http://localhost:8787")
```

### 3. Build & Run

1. Select a target device or simulator (iPhone 15 recommended)
2. Press `Cmd+R` to build and run
3. Grant any permissions if prompted

### 4. Testing

The app includes:

- **SwiftUI Previews**: Available for all views (`Cmd+Opt+P`)
- **Unit tests**: Run with `Cmd+U`
- **Accessibility Inspector**: Built into Xcode

## Key Features

### Reading Flow

1. **Spread Selection**: Choose from Single Card, Three-Card Story, Five-Card Clarity, or Celtic Cross
2. **Question Input**: Enter an open-ended question
3. **Ritual**: Set knocks and cut position for seeded randomness
4. **Card Reveal**: Animated card flip reveals with staggered timing
5. **Narrative Generation**: AI-powered reading from the API

### Journal

- Save unlimited readings
- Search by question or content
- Swipe to delete entries
- Share readings as text
- Automatic pagination

### Accessibility Features

#### VoiceOver Support
Every view includes proper accessibility labels and hints:

```swift
Text("The Fool")
    .accessibilityLabel("The Fool, upright, in position: Theme / Guidance")
    .accessibilityHint("Major Arcana card representing new beginnings")
```

#### Dynamic Type
All text scales with user preferences:

```swift
.font(.body) // Automatically scales
.dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Capped at xxxLarge
```

#### High Contrast
Uses semantic colors that adapt to accessibility settings:

```swift
.foregroundStyle(.primary)   // Adapts to contrast
.background(.secondarySystemBackground)
```

#### Reduced Motion
Animations respect `UIAccessibility.isReduceMotionEnabled`:

```swift
withAnimation(.spring(response: isReduceMotionEnabled ? 0 : 0.6)) {
    // Animation code
}
```

### Dark Mode

All views automatically support dark mode via semantic colors:

```swift
Color(.systemBackground)      // White in light, black in dark
Color(.secondarySystemBackground)
Color(.label)
Color(.secondaryLabel)
```

## API Endpoints Used

### Core Reading
- `POST /api/tarot-reading` — Generate reading narrative
- `GET /api/health/tarot-reading` — Health check

### Journal
- `GET /api/journal?limit=50&offset=0` — Fetch entries
- `POST /api/journal` — Save reading
- `DELETE /api/journal/:id` — Delete entry

### Future Enhancements
- `POST /api/generate-question` — AI question suggestions
- `POST /api/tts` — Text-to-speech
- `GET /api/archetype-journey` — Pattern tracking

## Models

### TarotCard

```swift
struct TarotCard: Identifiable, Codable {
    let id: UUID
    let name: String
    let number: Int?        // Major Arcana number or Minor rank
    let suit: String?       // wands, cups, swords, pentacles
    let upright: String     // Upright meaning
    let reversed: String    // Reversed meaning
    let image: String       // Image path
    let isReversed: Bool
    let position: String?
    let positionIndex: Int?
}
```

### Spread

```swift
struct Spread: Identifiable, Codable {
    let id: String          // "single", "threeCard", "fiveCard", "celtic"
    let name: String
    let positions: [String] // Position meanings
    let count: Int          // Number of cards
    let description: String
    let complexity: Complexity
}
```

### Reading

```swift
struct Reading: Identifiable, Codable {
    let id: String
    let question: String
    let spreadKey: String
    let cards: [ReadingCard]
    let narrative: String
    let createdAt: Date
    let sessionSeed: String?
    let analysis: ReadingAnalysis?
}
```

## Customization

### Changing Accent Color

Modify `Assets.xcassets/AccentColor.colorset`:

```json
{
  "colors": [
    {
      "idiom": "universal",
      "color": {
        "color-space": "srgb",
        "components": {
          "red": "0.500",
          "green": "0.000",
          "blue": "0.500",
          "alpha": "1.000"
        }
      }
    }
  ]
}
```

### Adding Card Images

Place card images in `Resources/` and update the image paths in `DeckService.swift`:

```swift
image: "/images/cards/RWS1909_-_00_Fool.jpeg"
```

### Custom Spreads

Add new spreads to `Models/Spread.swift`:

```swift
static let custom = Spread(
    id: "custom",
    name: "Custom Spread",
    positions: ["Position 1", "Position 2"],
    roleKeys: ["role1", "role2"],
    count: 2,
    description: "Your custom spread description",
    mobileDescription: "Short description",
    complexity: Complexity(stars: 2, label: "Normal")
)
```

## Best Practices Implemented

### Apple Human Interface Guidelines

- **Navigation**: Clear hierarchy with back buttons and tab bar
- **Layout**: Adaptive layouts for all device sizes
- **Typography**: San Francisco font with proper hierarchy
- **Spacing**: Consistent 8pt grid system
- **Colors**: Semantic colors for light/dark mode
- **Touch targets**: Minimum 44×44pt tap areas

### SwiftUI Patterns

- **@Observable**: Modern state management (iOS 17+)
- **@Environment**: Dependency injection
- **@State/@Binding**: View-local state
- **Async/await**: Modern concurrency
- **Structured concurrency**: Task groups for parallel operations

### Error Handling

```swift
do {
    let response = try await apiClient.generateReading(request: request)
    currentReading = response
} catch let error as APIError {
    errorMessage = error.localizedDescription
} catch {
    errorMessage = "An unexpected error occurred"
}
```

### Security

- HTTPS-only networking
- No hardcoded secrets
- Secure credential storage (future: Keychain)
- Content Security Policy compliance

## Performance

### Lazy Loading
- Journal uses `LazyVStack` for efficient rendering
- Pagination loads 50 entries at a time
- Images loaded on-demand

### Memory Management
- Value types (structs) for models
- Automatic reference counting (ARC)
- No retain cycles in closures

### Network Efficiency
- URLSession connection pooling
- 30-second request timeout
- Automatic retry with exponential backoff (future)

## Troubleshooting

### Build Errors

**"Cannot find type 'TarotCard' in scope"**
- Ensure all files are added to the target
- Clean build folder (`Cmd+Shift+K`)

**"API requests fail with SSL error"**
- Check `Info.plist` `NSAppTransportSecurity` settings
- For local dev, you may need to allow arbitrary loads (not recommended for production)

### Runtime Issues

**Cards not loading**
- Verify API endpoint in Settings
- Check network connectivity
- Enable network logging in `APIClient.swift`

**Journal entries not appearing**
- Check API authentication (future feature)
- Verify date decoding strategy matches API format

## Contributing

This iOS app follows the same contribution guidelines as the main Tableu project:

1. Test on multiple devices (iPhone SE, iPhone 15 Pro, iPad)
2. Run SwiftLint for code style
3. Verify VoiceOver compatibility
4. Test in both light and dark mode
5. Ensure Dynamic Type support up to xxxLarge

## Roadmap

### Phase 1 (Current)
- [x] Core reading flow
- [x] Journal CRUD operations
- [x] Accessibility baseline
- [x] Dark mode support

### Phase 2
- [ ] Authentication integration
- [ ] TTS (Text-to-Speech) integration
- [ ] Offline mode with local storage
- [ ] iCloud sync for journal

### Phase 3
- [ ] Widgets (iOS 17+)
- [ ] Watch app companion
- [ ] App Clips for quick readings
- [ ] SharePlay for collaborative readings

### Phase 4
- [ ] iPad optimization with split views
- [ ] Vision Pro support
- [ ] Siri Shortcuts integration
- [ ] Push notifications for daily readings

## License

This iOS app is part of the Tableu project. See the root repository for license information.

## Credits

- **Tarot Images**: 1909 Rider-Waite deck (public domain)
- **Backend API**: Cloudflare Workers + Azure OpenAI
- **Framework**: SwiftUI, Swift 5.9+
- **Icons**: SF Symbols

---

**Questions?** Open an issue in the main repository or contact the maintainers.

Built with ❤️ for the tarot community.
