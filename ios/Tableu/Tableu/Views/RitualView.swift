import SwiftUI

/// View for performing the reading ritual (knocks and cut)
struct RitualView: View {
    @Environment(ReadingViewModel.self) private var viewModel
    @State private var showingKnockAnimation = false

    var body: some View {
        @Bindable var bindableViewModel = viewModel

        ScrollView {
            VStack(spacing: 32) {
                // Header
                VStack(spacing: 12) {
                    Text("Prepare Your Reading")
                        .font(.largeTitle.bold())

                    Text("Set your intention through ritual")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                // Question display
                VStack(alignment: .leading, spacing: 8) {
                    Text("Your Question")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)

                    Text(viewModel.question)
                        .font(.body)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color(.secondarySystemBackground))
                        )
                }
                .padding(.horizontal)

                // Knocks
                VStack(spacing: 16) {
                    Text("Knock on the Deck")
                        .font(.headline)

                    Text("Focus your intention with each knock")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Stepper(value: $bindableViewModel.knocks, in: 1...9) {
                        HStack {
                            Text("Knocks:")
                            Text("\(viewModel.knocks)")
                                .font(.title2.bold())
                                .foregroundStyle(.accentColor)
                        }
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(.secondarySystemBackground))
                    )
                    .accessibilityLabel("Number of knocks: \(viewModel.knocks)")
                    .accessibilityHint("Adjust the number of knocks between 1 and 9")

                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            showingKnockAnimation = true
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            showingKnockAnimation = false
                        }
                    } label: {
                        Label("Knock", systemImage: "hand.tap")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.accentColor)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .scaleEffect(showingKnockAnimation ? 0.95 : 1.0)
                    }
                    .accessibilityLabel("Perform knock animation")
                }
                .padding(.horizontal)

                // Cut position
                VStack(spacing: 16) {
                    Text("Cut the Deck")
                        .font(.headline)

                    Text("Choose where to split the deck")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    VStack(spacing: 8) {
                        Slider(value: Binding(
                            get: { Double(viewModel.cutPosition) },
                            set: { bindableViewModel.cutPosition = Int($0) }
                        ), in: 1...78, step: 1)
                        .accessibilityLabel("Cut position")
                        .accessibilityValue("\(viewModel.cutPosition) of 78")

                        Text("Position \(viewModel.cutPosition) of 78")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(.secondarySystemBackground))
                    )
                }
                .padding(.horizontal)

                // Draw button
                Button {
                    viewModel.performRitual()
                } label: {
                    Text("Draw Cards")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal)
                .disabled(!viewModel.canDrawCards)
                .accessibilityLabel("Draw cards for reading")
                .accessibilityHint("Draws \(viewModel.selectedSpread?.count ?? 0) cards based on your ritual")
            }
            .padding(.vertical)
        }
        .navigationTitle("Ritual")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Back") {
                    withAnimation {
                        viewModel.currentPhase = .spreadSelection
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        RitualView()
            .environment(ReadingViewModel())
    }
}
