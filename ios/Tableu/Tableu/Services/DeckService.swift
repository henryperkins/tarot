import Foundation

/// Service for handling deck operations: shuffling, drawing, and card management
@Observable
class DeckService {
    private var rng: SeededRNG

    init(seed: String? = nil) {
        self.rng = SeededRNG(seed: seed ?? UUID().uuidString)
    }

    /// Draw cards for a spread using seeded shuffle
    func drawSpread(_ spread: Spread, seed: String) -> [DrawnCard] {
        // Reset RNG with the provided seed
        self.rng = SeededRNG(seed: seed)

        // Create full 78-card deck
        var deck = createFullDeck()

        // Shuffle using seeded RNG
        deck.shuffle(using: &rng)

        // Draw the required number of cards
        var drawnCards: [DrawnCard] = []
        for (index, position) in spread.positions.enumerated() {
            guard index < deck.count else { break }

            var card = deck[index]

            // Randomly determine if reversed (30% chance)
            let reversalThreshold: UInt64 = UInt64(Double(UInt64.max) * 0.3)
            card.isReversed = rng.next() < reversalThreshold

            let drawnCard = DrawnCard(
                card: card,
                position: position,
                positionIndex: index
            )
            drawnCards.append(drawnCard)
        }

        return drawnCards
    }

    /// Generate a session seed from ritual data
    func computeSeed(knocks: Int, cutPosition: Int, question: String) -> String {
        let timestamp = Date().timeIntervalSince1970
        let combined = "\(knocks)-\(cutPosition)-\(question.lowercased())-\(timestamp)"
        return combined.sha256Hash
    }

    // MARK: - Private Methods

    private func createFullDeck() -> [TarotCard] {
        var deck: [TarotCard] = []

        // Major Arcana (22 cards)
        deck.append(contentsOf: majorArcana)

        // Minor Arcana (56 cards: 4 suits × 14 cards)
        for suit in ["Wands", "Cups", "Swords", "Pentacles"] {
            for rank in 1...14 {
                deck.append(minorArcanaCard(suit: suit, rank: rank))
            }
        }

        return deck
    }

    private func minorArcanaCard(suit: String, rank: Int) -> TarotCard {
        let rankName: String
        switch rank {
        case 1: rankName = "Ace"
        case 11: rankName = "Page"
        case 12: rankName = "Knight"
        case 13: rankName = "Queen"
        case 14: rankName = "King"
        default: rankName = "\(rank)"
        }

        return TarotCard(
            name: "\(rankName) of \(suit)",
            number: rank,
            suit: suit.lowercased(),
            upright: minorUprightMeaning(suit: suit, rank: rank),
            reversed: minorReversedMeaning(suit: suit, rank: rank),
            image: "/images/cards/RWS1909_-_\(suit)_\(String(format: "%02d", rank)).jpeg",
            isReversed: false,
            position: nil,
            positionIndex: nil
        )
    }

    private func minorUprightMeaning(suit: String, rank: Int) -> String {
        // Simplified meanings - in production, load from data files
        "\(suit) energy at rank \(rank)"
    }

    private func minorReversedMeaning(suit: String, rank: Int) -> String {
        "Blocked or reversed \(suit) energy at rank \(rank)"
    }

    private var majorArcana: [TarotCard] {
        [
            TarotCard(name: "The Fool", number: 0, suit: nil, upright: "New beginnings, innocence, spontaneity, free spirit", reversed: "Recklessness, taken advantage of, inconsideration", image: "/images/cards/RWS1909_-_00_Fool.jpeg", isReversed: false, position: nil, positionIndex: nil),
            TarotCard(name: "The Magician", number: 1, suit: nil, upright: "Manifestation, resourcefulness, power, inspired action", reversed: "Manipulation, poor planning, untapped talents", image: "/images/cards/RWS1909_-_01_Magician.jpeg", isReversed: false, position: nil, positionIndex: nil),
            TarotCard(name: "The High Priestess", number: 2, suit: nil, upright: "Intuition, sacred knowledge, divine feminine, subconscious", reversed: "Secrets, disconnected from intuition, withdrawal", image: "/images/cards/RWS1909_-_02_High_Priestess.jpeg", isReversed: false, position: nil, positionIndex: nil),
            // Add remaining major arcana cards...
        ]
    }
}

// MARK: - Seeded Random Number Generator

/// Simple seeded RNG for reproducible shuffles
struct SeededRNG: RandomNumberGenerator {
    private var state: UInt64

    init(seed: String) {
        // Simple hash of seed string
        self.state = UInt64(abs(seed.hashValue))
    }

    mutating func next() -> UInt64 {
        // Linear congruential generator
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
    }
}

// MARK: - Array Extension for Seeded Shuffle

extension Array {
    mutating func shuffle<T: RandomNumberGenerator>(using generator: inout T) {
        for i in (1..<count).reversed() {
            let j = Int(generator.next() % UInt64(i + 1))
            swapAt(i, j)
        }
    }
}

// MARK: - String Extension for SHA256

extension String {
    var sha256Hash: String {
        // Simplified hash - in production, use CryptoKit
        let hash = self.utf8.reduce(0) { ($0 &* 31 &+ UInt64($1)) % UInt64.max }
        return String(hash, radix: 16)
    }
}
