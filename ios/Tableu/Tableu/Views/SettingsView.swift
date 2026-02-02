import SwiftUI

/// Settings view for app configuration
struct SettingsView: View {
    @AppStorage("apiBaseURL") private var apiBaseURL = "https://tableu.app"
    @AppStorage("enableHaptics") private var enableHaptics = true
    @AppStorage("autoSaveReadings") private var autoSaveReadings = true

    var body: some View {
        NavigationStack {
            Form {
                Section("API Configuration") {
                    TextField("Base URL", text: $apiBaseURL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .accessibilityLabel("API base URL")
                }

                Section("Reading Preferences") {
                    Toggle("Auto-save Readings", isOn: $autoSaveReadings)
                        .accessibilityLabel("Automatically save readings to journal")

                    Toggle("Haptic Feedback", isOn: $enableHaptics)
                        .accessibilityLabel("Enable haptic feedback for interactions")
                }

                Section("Accessibility") {
                    Link(destination: URL(string: UIApplication.openSettingsURLString)!) {
                        HStack {
                            Text("System Accessibility Settings")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityLabel("Open system accessibility settings")
                }

                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }

                    Link("Privacy Policy", destination: URL(string: "https://tableu.app/privacy")!)
                    Link("Terms of Service", destination: URL(string: "https://tableu.app/terms")!)
                }

                Section {
                    Button(role: .destructive) {
                        // Clear local cache
                    } label: {
                        Text("Clear Cache")
                    }
                    .accessibilityLabel("Clear cached data")
                }
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    SettingsView()
}
