import Foundation
import CoreGraphics
import ImageIO

// CoreGraphics only: no application or display server is required.
let output = CommandLine.arguments.dropFirst().first ?? "."
let manager = FileManager.default
let iconset = URL(fileURLWithPath: output).appendingPathComponent("Rota.iconset")
try manager.createDirectory(at: iconset, withIntermediateDirectories: true)

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(red: CGFloat((hex >> 16) & 255) / 255,
            green: CGFloat((hex >> 8) & 255) / 255,
            blue: CGFloat(hex & 255) / 255, alpha: alpha)
}

func render(_ size: Int, to url: URL) throws {
    let space = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                                  bytesPerRow: size * 4, space: space,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("Bitmap creation failed") }
    context.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
    context.translateBy(x: 0, y: 1024)
    context.scaleBy(x: 1, y: -1)
    let shell = CGPath(roundedRect: CGRect(x: 64, y: 64, width: 896, height: 896), cornerWidth: 202, cornerHeight: 202, transform: nil)
    context.saveGState()
    context.setShadow(offset: CGSize(width: 0, height: 12), blur: 25, color: color(0x081420, 0.24))
    context.addPath(shell); context.setFillColor(color(0x20384e)); context.fillPath()
    context.restoreGState()
    context.saveGState(); context.addPath(shell); context.clip()
    let navy = CGGradient(colorsSpace: space, colors: [color(0x344b60), color(0x20384e), color(0x142b40)] as CFArray, locations: [0, 0.48, 1])!
    context.drawLinearGradient(navy, start: CGPoint(x: 144, y: 64), end: CGPoint(x: 882, y: 960), options: [])
    context.restoreGState()
    context.addPath(CGPath(roundedRect: CGRect(x: 67, y: 67, width: 890, height: 890), cornerWidth: 199, cornerHeight: 199, transform: nil))
    context.setStrokeColor(color(0xffffff, 0.13)); context.setLineWidth(6); context.strokePath()
    context.setLineCap(.round); context.setLineJoin(.round)
    let ring = CGMutablePath()
    ring.addArc(center: CGPoint(x: 512, y: 512), radius: 248, startAngle: 2.796, endAngle: 8.033, clockwise: false)
    context.addPath(ring); context.setStrokeColor(color(0xc8d1d1, 0.17)); context.setLineWidth(20); context.strokePath()
    let route = CGMutablePath()
    route.move(to: CGPoint(x: 316, y: 722))
    route.addCurve(to: CGPoint(x: 440, y: 608), control1: CGPoint(x: 316, y: 634), control2: CGPoint(x: 440, y: 693))
    route.addCurve(to: CGPoint(x: 495, y: 544), control1: CGPoint(x: 440, y: 567), control2: CGPoint(x: 473, y: 560))
    context.addPath(route); context.setStrokeColor(color(0xe7d8b9)); context.setLineWidth(36); context.strokePath()
    let needle = CGMutablePath()
    needle.move(to: CGPoint(x: 704, y: 298)); needle.addLine(to: CGPoint(x: 588, y: 650))
    needle.addLine(to: CGPoint(x: 519, y: 521)); needle.addLine(to: CGPoint(x: 388, y: 454)); needle.closeSubpath()
    context.saveGState(); context.addPath(needle); context.clip()
    let cream = CGGradient(colorsSpace: space, colors: [color(0xf2e8d2), color(0xd9c9a9)] as CFArray, locations: [0, 1])!
    context.drawLinearGradient(cream, start: CGPoint(x: 388, y: 298), end: CGPoint(x: 588, y: 650), options: [])
    context.restoreGState()
    context.move(to: CGPoint(x: 704, y: 298)); context.addLine(to: CGPoint(x: 519, y: 521)); context.addLine(to: CGPoint(x: 588, y: 650)); context.closePath()
    context.setFillColor(color(0xc6b994, 0.48)); context.fillPath()
    guard let image = context.makeImage(), let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else { fatalError("PNG creation failed") }
    CGImageDestinationAddImage(destination, image, nil)
    if !CGImageDestinationFinalize(destination) { fatalError("PNG export failed") }
}

for pointSize in [16, 32, 128, 256, 512] {
    try render(pointSize, to: iconset.appendingPathComponent("icon_\(pointSize)x\(pointSize).png"))
    try render(pointSize * 2, to: iconset.appendingPathComponent("icon_\(pointSize)x\(pointSize)@2x.png"))
}
try render(1024, to: URL(fileURLWithPath: output).appendingPathComponent("rota-app-icon.png"))
// A modern ICNS container with PNG representations. This also works on hosts
// where iconutil rejects otherwise valid iconsets.
func bigEndian(_ value: UInt32) -> Data {
    var encoded = value.bigEndian
    return Data(bytes: &encoded, count: MemoryLayout<UInt32>.size)
}
var chunks = Data()
for (type, filename) in [
    ("icp4", "icon_16x16.png"), ("icp5", "icon_32x32.png"),
    ("icp6", "icon_32x32@2x.png"), ("ic07", "icon_128x128.png"),
    ("ic08", "icon_256x256.png"), ("ic09", "icon_512x512.png"),
    ("ic10", "icon_512x512@2x.png"),
    ("ic11", "icon_16x16@2x.png"), ("ic12", "icon_32x32@2x.png"),
    ("ic13", "icon_128x128@2x.png"), ("ic14", "icon_256x256@2x.png")
] {
    let png = try Data(contentsOf: iconset.appendingPathComponent(filename))
    chunks.append(type.data(using: .ascii)!)
    chunks.append(bigEndian(UInt32(png.count + 8)))
    chunks.append(png)
}
var icns = "icns".data(using: .ascii)!
icns.append(bigEndian(UInt32(chunks.count + 8)))
icns.append(chunks)
try icns.write(to: URL(fileURLWithPath: output).appendingPathComponent("app.icns"))
try icns.write(to: URL(fileURLWithPath: output).appendingPathComponent("rota.icns"))
print("Rendered Rota icon and iconset in \(output)")
