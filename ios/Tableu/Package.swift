// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Tableu",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "Tableu",
            targets: ["Tableu"]
        ),
    ],
    dependencies: [
        // Add dependencies here if needed (e.g., Alamofire, SwiftyJSON)
    ],
    targets: [
        .target(
            name: "Tableu",
            dependencies: []
        ),
        .testTarget(
            name: "TableuTests",
            dependencies: ["Tableu"]
        ),
    ]
)
