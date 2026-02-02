import Foundation

/// Represents a tarot spread configuration
struct Spread: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let tag: String
    let positions: [String]
    let roleKeys: [String]
    let count: Int
    let description: String
    let mobileDescription: String
    let complexity: Complexity

    struct Complexity: Codable, Hashable {
        let stars: Int
        let label: String
    }

    /// Accessibility label for VoiceOver
    var accessibilityLabel: String {
        "\(name), \(count) cards, \(complexity.label) complexity. \(description)"
    }

    /// Short description for list view
    var shortDescription: String {
        "\(count) cards • \(complexity.label)"
    }
}

/// Available spreads
struct SpreadsResponse: Codable {
    let spreads: [String: Spread]
}

/// Common spreads used in the app
extension Spread {
    static let single = Spread(
        id: "single",
        name: "One-Card Insight",
        tag: "Quick",
        positions: ["Theme / Guidance of the Moment"],
        roleKeys: ["theme"],
        count: 1,
        description: "One card focused on your question's core energy.",
        mobileDescription: "Fast, single-card guidance.",
        complexity: Complexity(stars: 1, label: "Easy")
    )

    static let threeCard = Spread(
        id: "threeCard",
        name: "Three-Card Story",
        tag: "Story",
        positions: [
            "Past — influences that led here",
            "Present — where you stand now",
            "Future — trajectory if nothing shifts"
        ],
        roleKeys: ["past", "present", "future"],
        count: 3,
        description: "Past, present, and future—see how your story moves.",
        mobileDescription: "Past, present, future in three beats.",
        complexity: Complexity(stars: 2, label: "Normal")
    )

    static let fiveCard = Spread(
        id: "fiveCard",
        name: "Five-Card Clarity",
        tag: "Clarity",
        positions: [
            "Core of the matter",
            "Challenge or tension",
            "Hidden / subconscious influence",
            "Support / helpful energy",
            "Likely direction on current path"
        ],
        roleKeys: ["core", "challenge", "subconscious", "support", "direction"],
        count: 5,
        description: "Core tension, support, challenge, and direction.",
        mobileDescription: "Five cards for depth.",
        complexity: Complexity(stars: 2, label: "Normal")
    )

    static let celtic = Spread(
        id: "celtic",
        name: "Celtic Cross",
        tag: "Deep",
        positions: [
            "Present situation",
            "Challenge",
            "Past foundation",
            "Near future",
            "Conscious mind",
            "Subconscious",
            "Your approach / advice",
            "External influences",
            "Hopes and fears",
            "Likely outcome"
        ],
        roleKeys: [
            "present", "challenge", "past", "nearFuture",
            "conscious", "subconscious", "advice", "external",
            "hopesFears", "outcome"
        ],
        count: 10,
        description: "The classic 10-card deep dive.",
        mobileDescription: "Full 10-card analysis.",
        complexity: Complexity(stars: 3, label: "Advanced")
    )

    static let allSpreads: [Spread] = [
        .single, .threeCard, .fiveCard, .celtic
    ]
}
