import Foundation

/// ViewModel managing journal entries
@Observable
class JournalViewModel {
    private let apiClient: APIClient

    // MARK: - State
    var entries: [Reading] = []
    var isLoading = false
    var errorMessage: String?

    // Pagination
    private var currentOffset = 0
    private let pageSize = 50
    var hasMore = true

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // MARK: - Actions

    /// Fetch journal entries from the API
    func fetchEntries(refresh: Bool = false) async {
        if refresh {
            currentOffset = 0
            entries = []
            hasMore = true
        }

        guard hasMore, !isLoading else { return }

        isLoading = true
        errorMessage = nil

        do {
            let newEntries = try await apiClient.fetchJournalEntries(
                limit: pageSize,
                offset: currentOffset
            )

            if newEntries.isEmpty {
                hasMore = false
            } else {
                entries.append(contentsOf: newEntries)
                currentOffset += newEntries.count
            }

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    /// Save a reading to the journal
    func saveReading(_ reading: Reading) async {
        do {
            try await apiClient.saveReading(reading)
            // Refresh to show the new entry
            await fetchEntries(refresh: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Delete a journal entry
    func deleteEntry(_ reading: Reading) async {
        do {
            try await apiClient.deleteJournalEntry(id: reading.id)
            entries.removeAll { $0.id == reading.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Filter entries by spread type
    func entriesForSpread(_ spreadKey: String) -> [Reading] {
        entries.filter { $0.spreadKey == spreadKey }
    }

    /// Get entries within date range
    func entriesInDateRange(from: Date, to: Date) -> [Reading] {
        entries.filter { entry in
            entry.createdAt >= from && entry.createdAt <= to
        }
    }
}
