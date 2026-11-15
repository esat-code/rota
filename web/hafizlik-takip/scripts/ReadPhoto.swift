import Foundation
import Vision
import ImageIO
let url=URL(fileURLWithPath:CommandLine.arguments[1])
let orientation: CGImagePropertyOrientation = CommandLine.arguments[2] == "left" ? .left : CommandLine.arguments[2] == "right" ? .right : .up
let request=VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["tr-TR","en-US"]
request.usesLanguageCorrection = false
let handler=VNImageRequestHandler(url:url,orientation:orientation)
do {
    try handler.perform([request])
    let rows=(request.results ?? []).compactMap { item -> [String:Any]? in
        guard let text=item.topCandidates(1).first else{return nil}
        return ["text":text.string,"confidence":text.confidence,"x":item.boundingBox.midX,"y":item.boundingBox.midY,"width":item.boundingBox.width]
    }
    let data=try JSONSerialization.data(withJSONObject:rows,options:[.prettyPrinted,.sortedKeys])
    if CommandLine.arguments.count>3{try data.write(to:URL(fileURLWithPath:CommandLine.arguments[3]))}else{print(String(data:data,encoding:.utf8)!)}
}catch{fputs(error.localizedDescription,stderr);exit(1)}
