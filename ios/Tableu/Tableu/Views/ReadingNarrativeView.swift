import SwiftUI

/// View displaying the generated reading narrative
struct ReadingNarrativeView: View {
    @Environment(ReadingViewModel.self) private var viewModel
    @Environment(JournalViewModel.self) private var journalViewModel
    @State private var showingSaveConfirmation = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Question
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Question")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)

                    Text(viewModel.question)
                        .font(.title3.weight(.medium))
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.secondarySystemBackground))
                )

                // Cards summary
                VStack(alignment: .leading, spacing: 12) {
                    Text("Your Cards")
                        .font(.headline)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(viewModel.drawnCards) { drawnCard in
                                MiniCardView(card: drawnCard.card, position: drawnCard.position)
                            }
                        }
                    }
                }

                Divider()

                // Narrative
                VStack(alignment: .leading, spacing: 12) {
                    Text("Your Reading")
                        .font(.title2.bold())
                        .accessibilityAddTraits(.isHeader)

                    Text(viewModel.currentReading?.narrative ?? "")
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineSpacing(6)
                        .textSelection(.enabled)
                        .accessibilityLabel("Reading narrative")
                }

                // Analysis info (if available)
                if let analysis = viewModel.currentReading?.analysis {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Reading Context")
                            .font(.headline)

                        if let framework = analysis.reversalFramework {
                            Label(framework.capitalized, systemImage: "arrow.triangle.2.circlepath")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        if let patterns = analysis.detectedPatterns, !patterns.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Detected Patterns:")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)

                                ForEach(patterns, id: \.self) { pattern in
                                    Text("• \(pattern)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(.tertiarySystemBackground))
                    )
                }
            }
            .padding()
        }
        .navigationTitle("Your Reading")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                // Save to journal
                Button {
                    Task {
                        if let reading = viewModel.currentReading {
                            await journalViewModel.saveReading(reading)
                            showingSaveConfirmation = true
                        }
                    }
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                }
                .accessibilityLabel("Save reading to journal")

                // Share
                if let reading = viewModel.currentReading {
                    ShareLink(item: formatReadingForSharing(reading)) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                    .accessibilityLabel("Share reading")
                }

                // New reading
                Button {
                    viewModel.reset()
                } label: {
                    Label("New", systemImage: "plus.circle")
                }
                .accessibilityLabel("Start new reading")
            }
        }
        .alert("Saved to Journal", isPresented: $showingSaveConfirmation) {
            Button("OK", role: .cancel) { }
        }
    }

    private func formatReadingForSharing(_ reading: Reading) -> String {
        var text = "Tarot Reading\n\n"
        text += "Question: \(reading.question)\n\n"
        text += "Cards:\n"
        for card in reading.cards {
            text += "• \(card.displayName) (\(card.reversed ? "Reversed" : "Upright"))\n"
        }
        text += "\n\(reading.narrative)"
        return text
    }
}

/// Compact card view for horizontal scrolling
struct MiniCardView: View {
    let card: TarotCard
    let position: String

    var body: some View {
        VStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray5))
                .frame(width: 80, height: 120)
                .overlay {
                    VStack {
                        Text(card.displayName)
                            .font(.caption2)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)

                        if card.isReversed {
                            Image(systemName: "arrow.down")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                    .padding(4)
                }

            Text(position)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(width: 90)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(card.displayName), \(position)")
    }
}

#Preview {
    NavigationStack {
        ReadingNarrativeView()
            .environment(ReadingViewModel())
            .environment(JournalViewModel())
    }
}
