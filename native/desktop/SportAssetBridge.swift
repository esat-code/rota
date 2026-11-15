import Foundation

/// Reads only the bundled pose-inference assets, never a caller-selected path.
/// WKWebView's file origin cannot fetch a WASM model normally; the caller sends
/// this bounded data to the sports iframe without opening a local HTTP server.
final class SportAssetBridge {
    struct Asset {
        let data: Data
        let mimeType: String
    }

    enum AssetError: LocalizedError {
        case unsupportedName, missingAsset, invalidAsset, oversizedAsset

        var errorDescription: String? {
            switch self {
            case .unsupportedName: return "Bu spor analiz dosyasına erişilemiyor."
            case .missingAsset: return "Spor analiz dosyası uygulama paketinde bulunamadı."
            case .invalidAsset: return "Spor analiz dosyası okunamadı."
            case .oversizedAsset: return "Spor analiz dosyası izin verilen boyutu aşıyor."
            }
        }
    }

    private static let allowedTypes = [
        "vision_wasm_internal.js": "text/javascript",
        "vision_wasm_internal.wasm": "application/wasm",
        "vision_wasm_nosimd_internal.js": "text/javascript",
        "vision_wasm_nosimd_internal.wasm": "application/wasm",
        "pose_landmarker_lite.task": "application/octet-stream"
    ]
    private static let maximumBytes = 15 * 1024 * 1024

    static func data(for filename: String) throws -> Asset {
        guard let mimeType = allowedTypes[filename] else { throw AssetError.unsupportedName }
        guard let resources = Bundle.main.resourceURL else { throw AssetError.missingAsset }
        let directory = resources.appendingPathComponent("sport/assets/mediapipe", isDirectory: true)
            .resolvingSymlinksInPath().standardizedFileURL
        let file = directory.appendingPathComponent(filename, isDirectory: false)
        // Also reject a symlink that would leave this one bundled directory.
        let resolved = file.resolvingSymlinksInPath().standardizedFileURL
        guard resolved.deletingLastPathComponent() == directory,
              resolved.lastPathComponent == filename else { throw AssetError.invalidAsset }

        let attributes: [FileAttributeKey: Any]
        do { attributes = try FileManager.default.attributesOfItem(atPath: resolved.path) }
        catch { throw AssetError.missingAsset }
        guard attributes[.type] as? FileAttributeType == .typeRegular,
              let size = attributes[.size] as? NSNumber, size.intValue > 0 else { throw AssetError.invalidAsset }
        guard size.intValue <= maximumBytes else { throw AssetError.oversizedAsset }
        let bytes: Data
        do { bytes = try Data(contentsOf: resolved, options: .mappedIfSafe) }
        catch { throw AssetError.invalidAsset }
        guard !bytes.isEmpty, bytes.count <= maximumBytes else { throw AssetError.oversizedAsset }
        return Asset(data: bytes, mimeType: mimeType)
    }
}
