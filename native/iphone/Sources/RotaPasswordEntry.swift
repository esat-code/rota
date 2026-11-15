import UIKit
import WebKit

@MainActor
final class RotaPasswordEntry: NSObject, WKScriptMessageHandler, UITextFieldDelegate {
    private weak var web: WKWebView?
    private var frame: WKFrameInfo?
    private let card = UIView()
    private let field = UITextField()
    private let reveal = UIButton(type: .system)
    private let submit = UIButton(type: .system)
    private let note = UILabel()
    private let error = UILabel()
    private var top: NSLayoutConstraint!
    private var leading: NSLayoutConstraint!
    private var width: NSLayoutConstraint!
    private var height: NSLayoutConstraint!
    private var submitting = false
    private var generation = 0

    init(web: WKWebView) {
        self.web = web
        super.init()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = UIColor(red: 0.055, green: 0.06, blue: 0.07, alpha: 1)
        card.layer.cornerRadius = 24
        card.layer.borderWidth = 1
        card.layer.borderColor = UIColor.white.withAlphaComponent(0.16).cgColor
        card.isHidden = true
        web.addSubview(card)

        let input = UIView()
        input.layer.cornerRadius = 14
        input.layer.borderWidth = 1
        input.layer.borderColor = UIColor.white.withAlphaComponent(0.2).cgColor
        input.backgroundColor = UIColor.white.withAlphaComponent(0.025)
        let lock = UIImageView(image: UIImage(systemName: "lock"))
        lock.tintColor = .systemGray
        lock.contentMode = .scaleAspectFit
        field.delegate = self
        field.font = .systemFont(ofSize: 18)
        field.textColor = .white
        field.tintColor = .white
        field.isSecureTextEntry = true
        field.textContentType = nil
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.autocapitalizationType = .none
        field.smartDashesType = .no
        field.smartQuotesType = .no
        field.smartInsertDeleteType = .no
        field.keyboardAppearance = .dark
        field.returnKeyType = .go
        field.clearsOnBeginEditing = false
        field.accessibilityIdentifier = "rota-native-password"
        field.accessibilityLabel = "Giriş şifren"
        field.attributedPlaceholder = NSAttributedString(string: "Giriş şifren", attributes: [.foregroundColor:UIColor.systemGray, .font:UIFont.systemFont(ofSize:13)])
        reveal.setImage(Self.eyeImage(hidden:true), for: .normal)
        reveal.tintColor = .systemGray
        reveal.accessibilityLabel = "Şifreyi göster"
        reveal.addTarget(self, action: #selector(toggleReveal), for: .touchUpInside)
        for view in [lock, field, reveal] {view.translatesAutoresizingMaskIntoConstraints = false; input.addSubview(view)}
        NSLayoutConstraint.activate([
            input.heightAnchor.constraint(equalToConstant:62),
            lock.leadingAnchor.constraint(equalTo:input.leadingAnchor,constant:17),
            lock.centerYAnchor.constraint(equalTo:input.centerYAnchor),
            lock.widthAnchor.constraint(equalToConstant:18), lock.heightAnchor.constraint(equalToConstant:18),
            field.leadingAnchor.constraint(equalTo:lock.trailingAnchor,constant:11),
            field.topAnchor.constraint(equalTo:input.topAnchor,constant:8), field.bottomAnchor.constraint(equalTo:input.bottomAnchor,constant:-8),
            reveal.trailingAnchor.constraint(equalTo:input.trailingAnchor,constant:-5),
            reveal.centerYAnchor.constraint(equalTo:input.centerYAnchor),
            reveal.widthAnchor.constraint(equalToConstant:44), reveal.heightAnchor.constraint(equalToConstant:44),
            field.trailingAnchor.constraint(equalTo:reveal.leadingAnchor,constant:-4),
        ])
        submit.setTitle("Giriş yap   ↗", for:.normal)
        submit.setTitleColor(UIColor(white:0.08,alpha:1), for:.normal)
        submit.titleLabel?.font = .systemFont(ofSize:14,weight:.semibold)
        submit.backgroundColor = UIColor(white:0.94,alpha:1)
        submit.layer.cornerRadius = 13
        submit.heightAnchor.constraint(equalToConstant:51).isActive = true
        submit.addTarget(self, action:#selector(unlock), for:.touchUpInside)
        for label in [note,error] {
            label.font = .systemFont(ofSize:11)
            label.textAlignment = .center
            label.numberOfLines = 0
        }
        note.textColor = .systemGray
        error.textColor = UIColor(red:0.85,green:0.69,blue:0.6,alpha:1)
        error.isHidden = true
        let stack = UIStackView(arrangedSubviews:[input,submit,note,error])
        stack.axis = .vertical; stack.spacing = 22
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        top = card.topAnchor.constraint(equalTo:web.topAnchor)
        top.priority = .defaultHigh
        leading = card.leadingAnchor.constraint(equalTo:web.leadingAnchor)
        width = card.widthAnchor.constraint(equalToConstant:320)
        height = card.heightAnchor.constraint(greaterThanOrEqualToConstant:220)
        NSLayoutConstraint.activate([
            top,leading,width,height,
            card.topAnchor.constraint(greaterThanOrEqualTo:web.safeAreaLayoutGuide.topAnchor,constant:8),
            card.bottomAnchor.constraint(lessThanOrEqualTo:web.keyboardLayoutGuide.topAnchor,constant:-12),
            stack.topAnchor.constraint(equalTo:card.topAnchor,constant:28),
            stack.bottomAnchor.constraint(equalTo:card.bottomAnchor,constant:-22),
            stack.leadingAnchor.constraint(equalTo:card.leadingAnchor,constant:23),
            stack.trailingAnchor.constraint(equalTo:card.trailingAnchor,constant:-23),
        ])
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let web, message.webView === web,
              message.frameInfo.securityOrigin.protocol == "https",
              message.frameInfo.securityOrigin.host == URL(string:RotaSession.origin)?.host,
              let body = message.body as? [String:Any] else {return}
        guard body["visible"] as? Bool == true else {hide(); return}
        guard let rect = body["rect"] as? [String:Double], let x = rect["x"], let y = rect["y"],
              let w = rect["width"], let h = rect["height"], let viewport = body["viewport"] as? Double,
              [x,y,w,h,viewport].allSatisfy({$0.isFinite}), w > 20, h > 20, viewport > 0 else {return}
        frame = message.frameInfo
        let scale = web.bounds.width / viewport
        leading.constant = x * scale
        top.constant = y * scale
        width.constant = w * scale
        height.constant = min(h * scale,320)
        note.text = body["note"] as? String
        card.isHidden = false
        web.bringSubviewToFront(card)
        web.callAsyncJavaScript("document.body.dataset.nativePassword = ''; return true;", arguments:[:], in:frame, in:.page, completionHandler:nil)
    }

    func hide() {
        generation += 1
        field.resignFirstResponder()
        field.text = ""
        field.isSecureTextEntry = true
        reveal.setImage(Self.eyeImage(hidden:true),for:.normal)
        reveal.accessibilityLabel = "Şifreyi göster"
        card.isHidden = true
        error.isHidden = true
        submitting = false
        submit.isEnabled = true
    }

    private static func eyeImage(hidden: Bool) -> UIImage {
        // Match the original 18-point SVG instead of the larger system symbol.
        UIGraphicsImageRenderer(size:CGSize(width:18,height:18)).image { context in
            let cg = context.cgContext
            cg.scaleBy(x:0.75,y:0.75)
            cg.setStrokeColor(UIColor.systemGray.cgColor)
            cg.setLineWidth(1.4)
            cg.setLineCap(.round)
            cg.move(to:CGPoint(x:2,y:12))
            cg.addCurve(to:CGPoint(x:12,y:5),control1:CGPoint(x:2,y:12),control2:CGPoint(x:5.5,y:5))
            cg.addCurve(to:CGPoint(x:22,y:12),control1:CGPoint(x:18.5,y:5),control2:CGPoint(x:22,y:12))
            cg.addCurve(to:CGPoint(x:12,y:19),control1:CGPoint(x:22,y:12),control2:CGPoint(x:18.5,y:19))
            cg.addCurve(to:CGPoint(x:2,y:12),control1:CGPoint(x:5.5,y:19),control2:CGPoint(x:2,y:12))
            cg.closePath()
            cg.strokePath()
            cg.strokeEllipse(in:CGRect(x:9,y:9,width:6,height:6))
            if hidden {cg.move(to:CGPoint(x:3,y:3));cg.addLine(to:CGPoint(x:21,y:21));cg.strokePath()}
        }.withRenderingMode(.alwaysTemplate)
    }

    func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
        guard textField.isSecureTextEntry, textField.markedTextRange == nil else {return true}
        let current = textField.text ?? ""
        guard let replaced = Range(range,in:current) else {return false}
        // Assigning secure text masks every character immediately. The default
        // last-character reveal otherwise leaves a newly typed space invisible.
        textField.text = current.replacingCharacters(in:replaced,with:string)
        let offset = range.location + string.utf16.count
        if let position = textField.position(from:textField.beginningOfDocument,offset:offset) {
            textField.selectedTextRange = textField.textRange(from:position,to:position)
        }
        textField.sendActions(for:.editingChanged)
        return false
    }

    func textFieldDidBeginEditing(_ textField: UITextField) {editing(true)}
    func textFieldDidEndEditing(_ textField: UITextField) {editing(false)}
    private func editing(_ value: Bool) {
        web?.callAsyncJavaScript("document.body.dataset.nativePasswordEditing = editing ? 'true' : 'false';", arguments:["editing":value], in:frame, in:.page, completionHandler:nil)
    }
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {unlock(); return false}

    @objc private func toggleReveal() {
        let value = field.text
        let selection = field.selectedTextRange
        let offsets = selection.map { (field.offset(from:field.beginningOfDocument,to:$0.start),field.offset(from:field.beginningOfDocument,to:$0.end)) }
        field.isSecureTextEntry.toggle()
        // Reinserting avoids UIKit clearing secure text on the next keystroke.
        field.text = ""
        field.insertText(value ?? "")
        if let offsets, let start = field.position(from:field.beginningOfDocument,offset:offsets.0),
           let end = field.position(from:field.beginningOfDocument,offset:offsets.1) {field.selectedTextRange = field.textRange(from:start,to:end)}
        reveal.setImage(Self.eyeImage(hidden:field.isSecureTextEntry),for:.normal)
        reveal.accessibilityLabel = field.isSecureTextEntry ? "Şifreyi göster" : "Şifreyi gizle"
    }

    @objc private func unlock() {
        guard !submitting, let web, let frame else {return}
        submitting = true
        submit.isEnabled = false
        error.isHidden = true
        let pendingGeneration = generation
        web.callAsyncJavaScript("return await window.rotaUnlockNativePassword(value);", arguments:["value":field.text ?? ""], in:frame, in:.page) { [weak self] result in
            guard let self, self.generation == pendingGeneration else {return}
            self.submitting = false
            self.submit.isEnabled = true
            if case .success(let value) = result, let answer = value as? [String:Any] {
                if answer["ok"] as? Bool == true {self.hide(); return}
                self.error.text = answer["error"] as? String ?? "Şifre kontrol edilemedi."
            } else {self.error.text = "Şifre kontrol edilemedi. Tekrar deneyebilirsin."}
            self.error.isHidden = false
            self.field.becomeFirstResponder()
        }
    }
}
