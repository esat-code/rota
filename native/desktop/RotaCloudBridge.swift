import Foundation
import Security
import WebKit

// The service credential stays in macOS Keychain, never in HTML or JavaScript.
final class RotaCloudBridge: NSObject, WKScriptMessageHandler, URLSessionTaskDelegate {
    static let origin = "https://YOUR-ROTA-SERVER.example"
    private static let service = "local.rota.cloud"
    // Keep the existing Keychain account for this private Site after its hostname changed.
    private static let keychainAccount = "https://YOUR-ROTA-SERVER.example"
    private static var key: [String: Any] { [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:keychainAccount] }
    private lazy var session = URLSession(configuration: .ephemeral, delegate:self, delegateQueue:nil)
    static func provision() -> Bool {
        let data = FileHandle.standardInput.readDataToEndOfFile()
        guard let input = try? JSONSerialization.jsonObject(with:data) as? [String:String], input["origin"] == origin,
              let token = input["token"], !token.isEmpty else { return false }
        let values:[String:Any] = [kSecValueData as String:Data(token.utf8)]
        let updated = SecItemUpdate(key as CFDictionary,values as CFDictionary)
        if updated == errSecSuccess { return true }
        guard updated == errSecItemNotFound else { return false }
        return SecItemAdd(key.merging(values){_,new in new} as CFDictionary,nil) == errSecSuccess
    }
    private func token() -> String? {
        var query=Self.key;query[kSecReturnData as String]=true;query[kSecMatchLimit as String]=kSecMatchLimitOne
        var value:CFTypeRef?;guard SecItemCopyMatching(query as CFDictionary,&value)==errSecSuccess,let data=value as? Data else{return nil}
        return String(data:data,encoding:.utf8)
    }
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}
    func userContentController(_ controller:WKUserContentController,didReceive message:WKScriptMessage){
        guard message.frameInfo.isMainFrame,let url=message.frameInfo.request.url,url.isFileURL,
              let root=Bundle.main.resourceURL,url.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path+"/"),
              let body=message.body as? [String:Any],let id=body["id"] as? String,UUID(uuidString:id) != nil,
              let method=body["method"] as? String,["GET","PUT","POST"].contains(method),let web=message.webView else{return}
        func reply(_ payload:[String:Any]){var result=payload;result["id"]=id;guard let data=try? JSONSerialization.data(withJSONObject:result),let json=String(data:data,encoding:.utf8)else{return};DispatchQueue.main.async{web.evaluateJavaScript("window.rotaCloudResult?.(\(json));",completionHandler:nil)}}
        guard let token=token() else{reply(["error":"Bulut bağlantısı kurulmamış. Yerel kayıtların korunuyor."]);return}
        var components=URLComponents(string:Self.origin+"/api/state")!
        if method=="GET",let revision=body["revision"] as? Int,revision>=0{components.queryItems=[URLQueryItem(name:"since",value:String(revision))]}
        var request=URLRequest(url:components.url!);request.httpMethod=method;request.timeoutInterval=20
        request.setValue("Bearer "+token,forHTTPHeaderField:"OAI-Sites-Authorization")
        request.setValue("desktop",forHTTPHeaderField:"X-Rota-Client")
        if method != "GET" {
            guard let value=body["body"] as? [String:Any],let data=try? JSONSerialization.data(withJSONObject:value),data.count<=1_802_000 else{reply(["error":"Kayıt boyutu geçersiz."]);return}
            request.httpBody=data;request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        }
        session.dataTask(with:request){data,response,error in
            guard error==nil,let response=response as? HTTPURLResponse,let data,let value=try? JSONSerialization.jsonObject(with:data) as? [String:Any] else{reply(["error":"İnternet bağlantısı bekleniyor. Kayıtların bu cihazda."]);return}
            reply(["status":response.statusCode,"value":value])
        }.resume()
    }
}
