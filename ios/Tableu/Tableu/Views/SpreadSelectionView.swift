import SwiftUI

/// View for selecting a tarot spread and entering a question
struct SpreadSelectionView: View {
    @Environment(ReadingViewModel.self) private var viewModel

    var body: some View {
        @Bindable var bindableViewModel = viewModel

        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Choose Your Spread")
                        .font(.largeTitle.bold())
                        .foregroundStyle(.primary)

                    Text("Each spread offers a different lens for reflection")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)

                // Question input
                VStack(alignment: .leading, spacing: 12) {
                    Text("Your Question")
                        .font(.headline)

                    TextField("How can I...", text: $bindableViewModel.question, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...6)
                        .accessibilityLabel("Question for the tarot")
                        .accessibilityHint("Enter an open-ended question that begins with how, what, or why")
                }
                .padding(.horizontal)

                // Spread cards
                LazyVStack(spacing: 16) {
                    ForEach(Spread.allSpreads) { spread in
                        SpreadCard(spread: spread, isSelected: viewModel.selectedSpread?.id == spread.id) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                viewModel.selectSpread(spread)
                            }
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .navigationTitle("New Reading")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Continue") {
                    withAnimation {
                        viewModel.currentPhase = .ritual
                    }
                }
                .disabled(!viewModel.canProceedToRitual)
                .accessibilityLabel("Continue to ritual")
                .accessibilityHint("Proceeds to the ritual phase after selecting a spread and entering a question")
            }
        }
    }
}

/// Card displaying a spread option
struct SpreadCard: View {
    let spread: Spread
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(spread.name)
                            .font(.headline)
                            .foregroundStyle(.primary)

                        Text(spread.shortDescription)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                            .imageScale(.large)
                            .accessibilityLabel("Selected")
                    }
                }

                Text(spread.description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)

                // Complexity indicator
                HStack(spacing: 4) {
                    ForEach(0..<spread.complexity.stars, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    Text(spread.complexity.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(spread.complexity.label) complexity, \(spread.complexity.stars) stars")
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Color.accentColor.opacity(0.1) : Color(.systemBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(
                                isSelected ? Color.accentColor : Color(.separator),
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spread.accessibilityLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview {
    NavigationStack {
        SpreadSelectionView()
            .environment(ReadingViewModel())
    }
}
