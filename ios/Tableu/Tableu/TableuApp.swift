import SwiftUI

@main
struct TableuApp: App {
    @State private var readingViewModel = ReadingViewModel()
    @State private var journalViewModel = JournalViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(readingViewModel)
                .environment(journalViewModel)
                .preferredColorScheme(nil) // Respects system dark mode
        }
    }
}

/// Main content view with tab-based navigation
struct ContentView: View {
    @Environment(ReadingViewModel.self) private var readingViewModel
    @Environment(JournalViewModel.self) private var journalViewModel

    var body: some View {
        TabView {
            ReadingFlowView()
                .tabItem {
                    Label("Reading", systemImage: "sparkles")
                }
                .accessibilityLabel("Tarot Reading")

            JournalListView()
                .tabItem {
                    Label("Journal", systemImage: "book.closed")
                }
                .accessibilityLabel("Reading Journal")

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .accessibilityLabel("Settings")
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge) // Support Dynamic Type up to xxxLarge
    }
}

#Preview {
    ContentView()
        .environment(ReadingViewModel())
        .environment(JournalViewModel())
}
