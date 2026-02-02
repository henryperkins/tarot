import SwiftUI

/// View showing drawn cards with flip animations
struct CardRevealView: View {
    @Environment(ReadingViewModel.self) private var viewModel
    @State private var revealedCards: Set<Int> = []

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                Text("Your Cards")
                    .font(.largeTitle.bold())
                    .padding(.top)

                // Cards grid
                LazyVStack(spacing: 20) {
                    ForEach(Array(viewModel.drawnCards.enumerated()), id: \.offset) { index, drawnCard in
                        CardView(
                            card: drawnCard.card,
                            position: drawnCard.position,
                            isRevealed: revealedCards.contains(index)
                        )
                        .onTapGesture {
                            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                                revealedCards.insert(index)
                            }
                        }
                        .transition(.scale.combined(with: .opacity))
                    }
                }
                .padding(.horizontal)

                // Generate reading button
                if revealedCards.count == viewModel.drawnCards.count {
                    Button {
                        Task {
                            await viewModel.generateReading()
                        }
                    } label: {
                        HStack {
                            if viewModel.isGenerating {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text(viewModel.isGenerating ? "Generating..." : "Generate Reading")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(viewModel.isGenerating)
                    .padding(.horizontal)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.spring(response: 0.5, dampingFraction: 0.8), value: revealedCards.count)
                    .accessibilityLabel("Generate reading narrative")
                    .accessibilityHint("Creates a personalized interpretation of your cards")
                }
            }
            .padding(.vertical)
        }
        .navigationTitle(viewModel.selectedSpread?.name ?? "Reading")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Auto-reveal cards with staggered animation
            for index in viewModel.drawnCards.indices {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.3) {
                    withAnimation {
                        revealedCards.insert(index)
                    }
                }
            }
        }
    }
}

/// Individual card display with flip animation
struct CardView: View {
    let card: TarotCard
    let position: String
    let isRevealed: Bool

    @State private var isFlipped = false

    var body: some View {
        VStack(spacing: 12) {
            // Position label
            Text(position)
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .accessibilityAddTraits(.isHeader)

            // Card image
            ZStack {
                // Card back
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [.purple.opacity(0.8), .blue.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay {
                        Image(systemName: "sparkles")
                            .font(.system(size: 60))
                            .foregroundStyle(.white.opacity(0.3))
                    }
                    .rotation3DEffect(
                        .degrees(isFlipped ? 180 : 0),
                        axis: (x: 0, y: 1, z: 0)
                    )
                    .opacity(isRevealed ? 0 : 1)

                // Card front
                VStack(spacing: 8) {
                    // Placeholder for actual card image
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.systemGray5))
                        .frame(height: 280)
                        .overlay {
                            VStack {
                                Text(card.displayName)
                                    .font(.headline)
                                    .multilineTextAlignment(.center)
                                    .padding()

                                if card.isReversed {
                                    Image(systemName: "arrow.down")
                                        .foregroundStyle(.red)
                                        .font(.title2)
                                }
                            }
                        }

                    Text(card.displayName)
                        .font(.headline)

                    if card.isReversed {
                        Text("Reversed")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                .rotation3DEffect(
                    .degrees(card.isReversed ? 180 : 0),
                    axis: (x: 0, y: 0, z: 1)
                )
                .rotation3DEffect(
                    .degrees(isFlipped ? 0 : -180),
                    axis: (x: 0, y: 1, z: 0)
                )
                .opacity(isRevealed ? 1 : 0)
            }
            .frame(maxWidth: 250)
            .aspectRatio(2/3, contentMode: .fit)
            .shadow(radius: 8)

            // Card meaning
            if isRevealed {
                Text(card.meaning)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                    .transition(.opacity)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color(.secondarySystemBackground))
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel(card.accessibilityLabel)
        .accessibilityValue(isRevealed ? card.meaning : "Not yet revealed")
        .onChange(of: isRevealed) { _, newValue in
            if newValue {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                    isFlipped = true
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        CardRevealView()
            .environment(ReadingViewModel())
    }
}
