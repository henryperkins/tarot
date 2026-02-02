import Foundation

/// Represents a tarot card with its meanings and visual assets
struct TarotCard: Identifiable, Codable, Hashable {
    let id = UUID()
    let name: String
    let number: Int?
    let suit: String?
    let upright: String
    let reversed: String
    let image: String
    let isReversed: Bool
    let position: String?
    let positionIndex: Int?

    enum CodingKeys: String, CodingKey {
        case name, number, suit, upright, reversed, image
        case isReversed = "reversed"
        case position, positionIndex
    }

    /// The card's meaning based on its orientation
    var meaning: String {
        isReversed ? reversed : upright
    }

    /// Full display name including suit for Minor Arcana
    var displayName: String {
        if let suit = suit, let number = number {
            return "\(rankName) of \(suit.capitalized)"
        }
        return name
    }

    /// Rank name for Minor Arcana (Ace, Two, etc.)
    private var rankName: String {
        guard let number = number else { return "" }

        switch number {
        case 1: return "Ace"
        case 11: return "Page"
        case 12: return "Knight"
        case 13: return "Queen"
        case 14: return "King"
        default: return numberToWord(number)
        }
    }

    private func numberToWord(_ num: Int) -> String {
        let words = ["", "One", "Two", "Three", "Four", "Five",
                     "Six", "Seven", "Eight", "Nine", "Ten"]
        return num < words.count ? words[num] : "\(num)"
    }

    /// Accessibility label for VoiceOver
    var accessibilityLabel: String {
        let orientation = isReversed ? "reversed" : "upright"
        if let position = position {
            return "\(displayName), \(orientation), in position: \(position)"
        }
        return "\(displayName), \(orientation)"
    }
}

/// Card drawn in a spread with position context
struct DrawnCard: Identifiable, Codable {
    let id = UUID()
    let card: TarotCard
    let position: String
    let positionIndex: Int

    enum CodingKeys: String, CodingKey {
        case card, position, positionIndex
    }
}
