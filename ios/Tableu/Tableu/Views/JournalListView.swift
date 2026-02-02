import SwiftUI

/// View displaying the user's journal of past readings
struct JournalListView: View {
    @Environment(JournalViewModel.self) private var viewModel
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.entries.isEmpty && !viewModel.isLoading {
                    emptyState
                } else {
                    journalList
                }
            }
            .navigationTitle("Journal")
            .searchable(text: $searchText, prompt: "Search readings")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task {
                            await viewModel.fetchEntries(refresh: true)
                        }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .disabled(viewModel.isLoading)
                    .accessibilityLabel("Refresh journal entries")
                }
            }
            .task {
                if viewModel.entries.isEmpty {
                    await viewModel.fetchEntries()
                }
            }
        }
    }

    private var journalList: some View {
        List {
            ForEach(filteredEntries) { reading in
                NavigationLink(destination: JournalDetailView(reading: reading)) {
                    JournalRowView(reading: reading)
                }
                .accessibilityLabel("Reading from \(reading.formattedDate)")
                .onAppear {
                    // Load more when reaching the end
                    if reading.id == viewModel.entries.last?.id {
                        Task {
                            await viewModel.fetchEntries()
                        }
                    }
                }
            }
            .onDelete { indexSet in
                Task {
                    for index in indexSet {
                        let reading = filteredEntries[index]
                        await viewModel.deleteEntry(reading)
                    }
                }
            }

            if viewModel.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Readings Yet", systemImage: "book.closed")
        } description: {
            Text("Your saved readings will appear here")
        } actions: {
            Button("Start a Reading") {
                // Switch to reading tab
            }
        }
        .accessibilityLabel("Journal is empty. No readings saved yet.")
    }

    private var filteredEntries: [Reading] {
        if searchText.isEmpty {
            return viewModel.entries
        }
        return viewModel.entries.filter { reading in
            reading.question.localizedCaseInsensitiveContains(searchText) ||
            reading.narrative.localizedCaseInsensitiveContains(searchText)
        }
    }
}

/// Row view for a journal entry
struct JournalRowView: View {
    let reading: Reading

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Date and spread
            HStack {
                Text(reading.formattedDate)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                if let spread = Spread.allSpreads.first(where: { $0.id == reading.spreadKey }) {
                    Text(spread.tag)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.accentColor.opacity(0.2))
                        .foregroundStyle(.accentColor)
                        .clipShape(Capsule())
                }
            }

            // Question
            Text(reading.question)
                .font(.headline)
                .lineLimit(2)

            // Narrative preview
            Text(reading.narrativePreview)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(3)

            // Cards
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(reading.cards) { card in
                        Text(card.displayName)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(Color(.systemGray6))
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    JournalListView()
        .environment(JournalViewModel())
}
