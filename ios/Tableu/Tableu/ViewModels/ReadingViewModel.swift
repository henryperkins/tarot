import Foundation
import SwiftUI

/// ViewModel managing the reading flow: ritual, spread selection, drawing, and narrative generation
@Observable
class ReadingViewModel {
    // MARK: - Dependencies
    private let apiClient: APIClient
    private let deckService: DeckService

    // MARK: - State
    var selectedSpread: Spread?
    var question: String = ""
    var knocks: Int = 3
    var cutPosition: Int = 13
    var drawnCards: [DrawnCard] = []
    var currentReading: Reading?

    // Loading and error states
    var isGenerating = false
    var errorMessage: String?

    // Reading flow states
    enum ReadingPhase {
        case spreadSelection
        case ritual
        case drawing
        case revealing
        case narrative
    }
    var currentPhase: ReadingPhase = .spreadSelection

    init(apiClient: APIClient = .shared, deckService: DeckService = DeckService()) {
        self.apiClient = apiClient
        self.deckService = deckService
    }

    // MARK: - Actions

    /// Select a spread and move to ritual phase
    func selectSpread(_ spread: Spread) {
        selectedSpread = spread
        currentPhase = .ritual
    }

    /// Perform ritual and draw cards
    func performRitual() {
        guard let spread = selectedSpread else { return }

        let seed = deckService.computeSeed(
            knocks: knocks,
            cutPosition: cutPosition,
            question: question
        )

        drawnCards = deckService.drawSpread(spread, seed: seed)
        currentPhase = .revealing
    }

    /// Generate reading narrative from API
    func generateReading() async {
        guard let spread = selectedSpread else { return }

        isGenerating = true
        errorMessage = nil

        do {
            let seed = deckService.computeSeed(
                knocks: knocks,
                cutPosition: cutPosition,
                question: question
            )

            let cardDraws = drawnCards.map { drawn in
                ReadingRequest.CardDraw(
                    name: drawn.card.name,
                    reversed: drawn.card.isReversed,
                    position: drawn.position,
                    positionIndex: drawn.positionIndex
                )
            }

            let request = ReadingRequest(
                question: question,
                spreadKey: spread.id,
                cards: cardDraws,
                sessionSeed: seed,
                ritual: ReadingRequest.RitualData(
                    knocks: knocks,
                    cutPosition: cutPosition
                )
            )

            let response = try await apiClient.generateReading(request: request)

            // Convert response to Reading model
            currentReading = Reading(
                id: response.requestId ?? UUID().uuidString,
                question: question,
                spreadKey: spread.id,
                cards: response.cards,
                narrative: response.reading,
                createdAt: Date(),
                sessionSeed: seed,
                analysis: response.analysis
            )

            currentPhase = .narrative

        } catch {
            errorMessage = error.localizedDescription
        }

        isGenerating = false
    }

    /// Reset to start a new reading
    func reset() {
        selectedSpread = nil
        question = ""
        knocks = 3
        cutPosition = 13
        drawnCards = []
        currentReading = nil
        currentPhase = .spreadSelection
        errorMessage = nil
    }

    // MARK: - Validation

    var canProceedToRitual: Bool {
        selectedSpread != nil && !question.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var canDrawCards: Bool {
        knocks > 0 && (1...78).contains(cutPosition)
    }
}
