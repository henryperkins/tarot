import SwiftUI

/// Detailed view of a saved journal entry
struct JournalDetailView: View {
    let reading: Reading

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Date
                Text(reading.formattedDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                // Question
                VStack(alignment: .leading, spacing: 8) {
                    Text("Question")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)

                    Text(reading.question)
                        .font(.title3.weight(.medium))
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(.secondarySystemBackground))
                )

                // Cards
                VStack(alignment: .leading, spacing: 12) {
                    Text("Cards")
                        .font(.headline)

                    ForEach(Array(reading.cards.enumerated()), id: \.offset) { index, card in
                        HStack(alignment: .top, spacing: 12) {
                            // Card placeholder
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.systemGray5))
                                .frame(width: 60, height: 90)
                                .overlay {
                                    VStack {
                                        Text(card.displayName)
                                            .font(.caption2)
                                            .multilineTextAlignment(.center)
                                            .lineLimit(3)

                                        if card.reversed {
                                            Image(systemName: "arrow.down")
                                                .font(.caption2)
                                                .foregroundStyle(.red)
                                        }
                                    }
                                    .padding(4)
                                }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(card.position)
                                    .font(.subheadline.weight(.medium))

                                Text(card.displayName)
                                    .font(.subheadline)

                                if card.reversed {
                                    Text("Reversed")
                                        .font(.caption)
                                        .foregroundStyle(.red)
                                }

                                Text(card.meaning)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.tertiarySystemBackground))
                        )
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(card.position): \(card.displayName), \(card.reversed ? "reversed" : "upright")")
                    }
                }

                Divider()

                // Narrative
                VStack(alignment: .leading, spacing: 12) {
                    Text("Reading")
                        .font(.title2.bold())

                    Text(reading.narrative)
                        .font(.body)
                        .lineSpacing(6)
                        .textSelection(.enabled)
                }

                // Analysis
                if let analysis = reading.analysis {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Context")
                            .font(.headline)

                        if let framework = analysis.reversalFramework {
                            HStack {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                Text("Framework: \(framework.capitalized)")
                                    .font(.caption)
                            }
                            .foregroundStyle(.secondary)
                        }

                        if let tone = analysis.overallTone {
                            HStack {
                                Image(systemName: "waveform")
                                Text("Tone: \(tone)")
                                    .font(.caption)
                            }
                            .foregroundStyle(.secondary)
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
        .navigationTitle("Reading")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                ShareLink(item: formatReadingForSharing()) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
        }
    }

    private func formatReadingForSharing() -> String {
        var text = "Tarot Reading - \(reading.formattedDate)\n\n"
        text += "Question: \(reading.question)\n\n"
        text += "Cards:\n"
        for card in reading.cards {
            text += "• \(card.position): \(card.displayName) (\(card.reversed ? "Reversed" : "Upright"))\n"
        }
        text += "\n\(reading.narrative)"
        return text
    }
}

#Preview {
    NavigationStack {
        JournalDetailView(reading: Reading(
            id: "1",
            question: "How can I move forward?",
            spreadKey: "threeCard",
            cards: [],
            narrative: "Sample reading narrative...",
            createdAt: Date(),
            sessionSeed: nil,
            analysis: nil
        ))
    }
}
