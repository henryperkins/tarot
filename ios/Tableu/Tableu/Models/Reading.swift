import Foundation

/// A complete tarot reading with cards and narrative
struct Reading: Identifiable, Codable {
    let id: String
    let question: String
    let spreadKey: String
    let cards: [ReadingCard]
    let narrative: String
    let createdAt: Date
    let sessionSeed: String?
    let analysis: ReadingAnalysis?

    struct ReadingCard: Identifiable, Codable {
        let id = UUID()
        let name: String
        let suit: String?
        let number: Int?
        let reversed: Bool
        let position: String
        let positionIndex: Int
        let upright: String
        let reversed: String
        let image: String

        enum CodingKeys: String, CodingKey {
            case name, suit, number, reversed, position
            case positionIndex, upright, image
            case reversed = "reversed"
        }

        var meaning: String {
            reversed ? self.reversed : upright
        }

        var displayName: String {
            if let suit = suit, let number = number {
                return "\(rankName) of \(suit.capitalized)"
            }
            return name
        }

        private var rankName: String {
            guard let number = number else { return "" }

            switch number {
            case 1: return "Ace"
            case 11: return "Page"
            case 12: return "Knight"
            case 13: return "Queen"
            case 14: return "King"
            default: return "\(number)"
            }
        }
    }

    struct ReadingAnalysis: Codable {
        let elementalDignities: [String: String]?
        let reversalFramework: String?
        let detectedPatterns: [String]?
        let overallTone: String?
    }

    enum CodingKeys: String, CodingKey {
        case id, question, spreadKey, cards, narrative
        case createdAt = "created_at"
        case sessionSeed = "session_seed"
        case analysis
    }

    /// Formatted date string
    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: createdAt)
    }

    /// Short preview of narrative (first 150 characters)
    var narrativePreview: String {
        String(narrative.prefix(150)) + (narrative.count > 150 ? "..." : "")
    }
}

/// Request payload for generating a new reading
struct ReadingRequest: Codable {
    let question: String
    let spreadKey: String
    let cards: [CardDraw]
    let sessionSeed: String?
    let ritual: RitualData?

    struct CardDraw: Codable {
        let name: String
        let reversed: Bool
        let position: String
        let positionIndex: Int
    }

    struct RitualData: Codable {
        let knocks: Int
        let cutPosition: Int
    }
}

/// Response from the reading API
struct ReadingResponse: Codable {
    let reading: String
    let cards: [Reading.ReadingCard]
    let spreadKey: String
    let question: String
    let analysis: Reading.ReadingAnalysis?
    let requestId: String?
}
