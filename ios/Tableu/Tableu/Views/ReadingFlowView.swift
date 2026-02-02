import SwiftUI

/// Orchestrates the complete reading flow from spread selection to narrative
struct ReadingFlowView: View {
    @Environment(ReadingViewModel.self) private var viewModel

    var body: some View {
        NavigationStack {
            Group {
                switch viewModel.currentPhase {
                case .spreadSelection:
                    SpreadSelectionView()
                case .ritual:
                    RitualView()
                case .revealing:
                    CardRevealView()
                case .narrative:
                    ReadingNarrativeView()
                case .drawing:
                    ProgressView("Drawing cards...")
                }
            }
            .animation(.smooth, value: viewModel.currentPhase)
        }
    }
}

#Preview {
    ReadingFlowView()
        .environment(ReadingViewModel())
}
