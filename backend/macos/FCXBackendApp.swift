import AppKit
import SwiftUI

private enum BackendStatus: Equatable {
    case starting
    case running
    case stopping
    case stopped
    case failed(String)

    var title: String {
        switch self {
        case .starting: "正在启动"
        case .running: "运行中"
        case .stopping: "正在停止"
        case .stopped: "已停止"
        case .failed: "启动失败"
        }
    }

    var detail: String {
        switch self {
        case .starting: "正在准备本地求解服务"
        case .running: "浏览器可以安全连接本机服务"
        case .stopping: "正在结束后台进程"
        case .stopped: "服务当前没有运行"
        case .failed(let message): message
        }
    }

    var symbol: String {
        switch self {
        case .starting: "circle.dotted"
        case .running: "checkmark.circle.fill"
        case .stopping: "hourglass.circle.fill"
        case .stopped: "pause.circle.fill"
        case .failed: "exclamationmark.triangle.fill"
        }
    }

    var color: Color {
        switch self {
        case .starting, .stopping: .orange
        case .running: .green
        case .stopped: .secondary
        case .failed: .red
        }
    }
}

private struct SbcSetStats: Codable, Identifiable {
    let setId: String
    let setName: String
    let todaySquadsSubmitted: Int
    let todaySetsCompleted: Int
    let totalSquadsSubmitted: Int
    let totalSetsCompleted: Int
    let lastActivityAt: String?

    var id: String { setId }
}

private struct SbcStats: Codable {
    let date: String
    let todaySquadsSubmitted: Int
    let todaySetsCompleted: Int
    let totalSquadsSubmitted: Int
    let totalSetsCompleted: Int
    let bySet: [SbcSetStats]

    static let empty = SbcStats(
        date: "", todaySquadsSubmitted: 0, todaySetsCompleted: 0,
        totalSquadsSubmitted: 0, totalSetsCompleted: 0, bySet: []
    )
}

private struct DiagnosticItem: Codable, Identifiable, Equatable {
    let level: String
    let title: String
    let message: String
    let suggestion: String
    let raw: String

    var id: String { "\(level)|\(title)|\(raw)" }
    var symbol: String {
        switch level {
        case "success": "checkmark.circle.fill"
        case "warning": "exclamationmark.triangle.fill"
        case "error": "xmark.octagon.fill"
        default: "info.circle.fill"
        }
    }
    var color: Color {
        switch level {
        case "success": .green
        case "warning": .orange
        case "error": .red
        default: .blue
        }
    }
}

private struct DiagnosticsPayload: Codable {
    let items: [DiagnosticItem]
}

@MainActor
private final class BackendModel: ObservableObject {
    @Published var portText: String
    @Published var diagnosticsExpanded = false
    @Published var technicalDetailsExpanded = false
    @Published private(set) var status: BackendStatus = .stopped
    @Published private(set) var technicalLogs: [String] = []
    @Published private(set) var stats: SbcStats = .empty
    @Published private(set) var diagnosticItems: [DiagnosticItem] = []

    private var process: Process?
    private var shutdownToken = ""
    private var instanceToken = ""
    private var healthTask: Task<Void, Never>?
    private var dashboardTask: Task<Void, Never>?

    init() {
        portText = String(Self.loadPort())
    }

    var port: Int? {
        guard let value = Int(portText), (1024...65535).contains(value) else {
            return nil
        }
        return value
    }

    var endpoint: String {
        "127.0.0.1:\(port ?? 8000)"
    }

    var canApply: Bool {
        port != nil && status != .starting && status != .stopping
    }

    func start() {
        guard process == nil else { return }
        guard let selectedPort = port else {
            status = .failed("端口必须是 1024 至 65535 的整数")
            return
        }

        status = .starting
        technicalLogs.removeAll(keepingCapacity: true)
        diagnosticItems.removeAll(keepingCapacity: true)
        shutdownToken = UUID().uuidString.replacingOccurrences(of: "-", with: "")
        instanceToken = UUID().uuidString

        guard let executable = Bundle.main.url(
            forResource: "FCXBackendService",
            withExtension: nil,
            subdirectory: "backend"
        ) else {
            status = .failed("应用内缺少本地求解服务")
            return
        }

        let child = Process()
        child.executableURL = executable
        child.arguments = ["--server", "--port", String(selectedPort)]
        child.currentDirectoryURL = executable.deletingLastPathComponent()

        var environment = ProcessInfo.processInfo.environment
        environment["FCX_GUI_SHUTDOWN_TOKEN"] = shutdownToken
        environment["FCX_GUI_INSTANCE_TOKEN"] = instanceToken
        environment["FCX_GUI_PARENT_PID"] = String(ProcessInfo.processInfo.processIdentifier)
        environment["FCX_SOLVER_LOG_DIR"] = Self.logDirectory.path
        environment["FCX_BACKEND_DATA_DIR"] = Self.applicationSupport.path
        environment["PYTHONUNBUFFERED"] = "1"
        environment["PYTHONUTF8"] = "1"
        environment["PYTHONIOENCODING"] = "utf-8"
        child.environment = environment

        let pipe = Pipe()
        child.standardOutput = pipe
        child.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else {
                return
            }
            Task { @MainActor in
                self?.appendLog(text)
            }
        }
        child.terminationHandler = { [weak self] finished in
            pipe.fileHandleForReading.readabilityHandler = nil
            Task { @MainActor in
                guard let self, self.process === finished else { return }
                self.process = nil
                self.healthTask?.cancel()
                self.dashboardTask?.cancel()
                if case .stopping = self.status {
                    self.status = .stopped
                } else if finished.terminationStatus != 0 {
                    self.status = .failed("本地服务意外退出（代码 \(finished.terminationStatus)）")
                }
            }
        }

        do {
            try FileManager.default.createDirectory(
                at: Self.logDirectory,
                withIntermediateDirectories: true
            )
            try child.run()
            process = child
            savePort(selectedPort)
            beginHealthChecks(port: selectedPort, instance: instanceToken)
        } catch {
            process = nil
            status = .failed(error.localizedDescription)
        }
    }

    func applyAndRestart() {
        guard let selectedPort = port else {
            status = .failed("端口必须是 1024 至 65535 的整数")
            return
        }
        savePort(selectedPort)
        stop(restartAfter: true)
    }

    func retry() {
        stop(restartAfter: true)
    }

    func stop(restartAfter: Bool = false) {
        healthTask?.cancel()
        dashboardTask?.cancel()
        guard let child = process else {
            status = .stopped
            if restartAfter { start() }
            return
        }

        status = .stopping
        let token = shutdownToken
        let selectedPort = port ?? 8000
        Task {
            var request = URLRequest(url: URL(string: "http://127.0.0.1:\(selectedPort)/shutdown")!)
            request.httpMethod = "POST"
            request.setValue(token, forHTTPHeaderField: "X-FCX-Shutdown-Token")
            _ = try? await URLSession.shared.data(for: request)
            try? await Task.sleep(for: .milliseconds(500))
            if child.isRunning { child.terminate() }
            if restartAfter {
                try? await Task.sleep(for: .milliseconds(250))
                self.process = nil
                self.start()
            }
        }
    }

    func terminateForAppExit() {
        healthTask?.cancel()
        dashboardTask?.cancel()
        if let child = process, child.isRunning {
            child.terminate()
        }
        process = nil
    }

    private func beginHealthChecks(port: Int, instance: String) {
        healthTask?.cancel()
        healthTask = Task {
            for _ in 0..<40 {
                guard !Task.isCancelled else { return }
                try? await Task.sleep(for: .milliseconds(250))
                guard let url = URL(string: "http://127.0.0.1:\(port)/health") else { continue }
                guard let (data, response) = try? await URLSession.shared.data(from: url),
                      (response as? HTTPURLResponse)?.statusCode == 200,
                      let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      payload["service"] as? String == "fcx-backend",
                      payload["port"] as? Int == port,
                      payload["instance"] as? String == instance else {
                    continue
                }
                status = .running
                appendLog("本地后端启动成功：http://127.0.0.1:\(port)")
                beginDashboardUpdates(port: port)
                return
            }
            if process?.isRunning == true {
                status = .failed("服务启动超时，请展开诊断信息查看详情")
            }
        }
    }

    private func appendLog(_ text: String) {
        let lines = text.split(whereSeparator: \Character.isNewline).map(String.init)
        technicalLogs.append(contentsOf: lines.filter { !$0.isEmpty })
        if technicalLogs.count > 600 {
            technicalLogs.removeFirst(technicalLogs.count - 500)
        }
    }

    private func beginDashboardUpdates(port: Int) {
        dashboardTask?.cancel()
        dashboardTask = Task {
            while !Task.isCancelled {
                await refreshDashboard(port: port)
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private func refreshDashboard(port: Int) async {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        if let url = URL(string: "http://127.0.0.1:\(port)/stats"),
           let (data, response) = try? await URLSession.shared.data(from: url),
           (response as? HTTPURLResponse)?.statusCode == 200,
           let payload = try? decoder.decode(SbcStats.self, from: data) {
            stats = payload
        }
        if let url = URL(string: "http://127.0.0.1:\(port)/diagnostics"),
           let (data, response) = try? await URLSession.shared.data(from: url),
           (response as? HTTPURLResponse)?.statusCode == 200,
           let payload = try? decoder.decode(DiagnosticsPayload.self, from: data) {
            diagnosticItems = payload.items
        }
    }

    func copyTechnicalDetails() {
        let text = technicalLogs.isEmpty ? "暂无技术详情" : technicalLogs.joined(separator: "\n")
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    private static var applicationSupport: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FCXBackend", isDirectory: true)
    }

    private static var logDirectory: URL {
        FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Logs/FCXBackend", isDirectory: true)
    }

    private static var settingsURL: URL {
        applicationSupport.appendingPathComponent("settings.json")
    }

    private static func loadPort() -> Int {
        guard let data = try? Data(contentsOf: settingsURL),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let value = payload["port"] as? Int,
              (1024...65535).contains(value) else {
            return 8000
        }
        return value
    }

    private func savePort(_ port: Int) {
        do {
            try FileManager.default.createDirectory(
                at: Self.applicationSupport,
                withIntermediateDirectories: true
            )
            let data = try JSONSerialization.data(
                withJSONObject: ["port": port],
                options: [.prettyPrinted, .sortedKeys]
            )
            try data.write(to: Self.settingsURL, options: .atomic)
        } catch {
            appendLog("保存端口失败：\(error.localizedDescription)")
        }
    }
}

private struct MetricTile: View {
    let title: String
    let value: Int
    let subtitle: String
    let symbol: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Label(title, systemImage: symbol)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
            Text(value, format: .number)
                .font(.system(size: 27, weight: .semibold, design: .rounded))
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.quaternary.opacity(0.42), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct SbcStatsCard: View {
    let stats: SbcStats

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("SBC 完成统计", systemImage: "soccerball")
                    .font(.headline)
                Spacer()
                Text("仅统计 FCX 自动提交且 EA 确认成功的记录")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 10) {
                MetricTile(title: "今日整组", value: stats.todaySetsCompleted, subtitle: "完成次数", symbol: "calendar")
                MetricTile(title: "累计整组", value: stats.totalSetsCompleted, subtitle: "完成次数", symbol: "trophy.fill")
                MetricTile(title: "今日阵容", value: stats.todaySquadsSubmitted, subtitle: "成功提交", symbol: "person.3.fill")
                MetricTile(title: "累计阵容", value: stats.totalSquadsSubmitted, subtitle: "成功提交", symbol: "sum")
            }

            if stats.bySet.isEmpty {
                Text("完成一次 SBC 后，这里会显示各项目明细。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 5)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(stats.bySet.prefix(4).enumerated()), id: \.element.id) { index, item in
                        HStack {
                            Text(item.setName)
                                .lineLimit(1)
                            Spacer()
                            Text("今日 \(item.todaySetsCompleted) · 累计 \(item.totalSetsCompleted) 组")
                                .font(.callout.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 8)
                        if index < min(stats.bySet.count, 4) - 1 { Divider() }
                    }
                }
            }
        }
        .padding(20)
        .modifier(PrimaryGlassSurface())
    }
}

private struct GlassStatusCard: View {
    let status: BackendStatus
    let endpoint: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: status.symbol)
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(status.color)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(status.title)
                    .font(.title3.weight(.semibold))
                Text(status.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 24)

            VStack(alignment: .trailing, spacing: 4) {
                Label("仅限本机", systemImage: "lock.shield.fill")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                Text(endpoint)
                    .font(.system(.body, design: .monospaced, weight: .medium))
                    .textSelection(.enabled)
            }
        }
        .padding(22)
        .modifier(PrimaryGlassSurface())
    }
}

private struct PrimaryGlassSurface: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 26.0, *) {
            content.glassEffect(.regular, in: .rect(cornerRadius: 26))
        } else {
            content.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        }
    }
}

private struct PrimaryActionButton: View {
    let title: String
    let symbol: String
    let action: () -> Void

    var body: some View {
        if #available(macOS 26.0, *) {
            Button(action: action) {
                Label(title, systemImage: symbol)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
        } else {
            Button(action: action) {
                Label(title, systemImage: symbol)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
    }
}

private struct RootView: View {
    @ObservedObject var model: BackendModel

    var body: some View {
        ZStack {
            ambientBackground

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    GlassStatusCard(status: model.status, endpoint: model.endpoint)
                    SbcStatsCard(stats: model.stats)
                    configuration
                    diagnostics
                }
                .padding(32)
            }
        }
        .frame(minWidth: 720, minHeight: 620)
        .onAppear { model.start() }
        .onDisappear { model.stop() }
    }

    private var ambientBackground: some View {
        ZStack {
            Color(nsColor: .windowBackgroundColor)
            Circle()
                .fill(Color.accentColor.opacity(0.17))
                .frame(width: 420, height: 420)
                .blur(radius: 80)
                .offset(x: 250, y: -180)
            Circle()
                .fill(Color.cyan.opacity(0.10))
                .frame(width: 360, height: 360)
                .blur(radius: 90)
                .offset(x: -300, y: 220)
        }
        .ignoresSafeArea()
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 16) {
            Image(nsImage: NSApp.applicationIconImage)
                .resizable()
                .scaledToFit()
                .frame(width: 52, height: 52)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text("FCX 本地后端")
                    .font(.largeTitle.weight(.semibold))
                Text("在这台 Mac 上安全完成 SBC 求解")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    private var configuration: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("连接设置", systemImage: "point.3.connected.trianglepath.dotted")
                .font(.headline)

            HStack(spacing: 12) {
                Text("端口")
                    .foregroundStyle(.secondary)
                TextField("8000", text: $model.portText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 104)
                    .accessibilityLabel("本地端口")

                PrimaryActionButton(title: "应用并重启", symbol: "arrow.clockwise") {
                    model.applyAndRestart()
                }
                .disabled(!model.canApply)

                if case .failed = model.status {
                    Button("重试", systemImage: "arrow.trianglehead.clockwise") {
                        model.retry()
                    }
                    .controlSize(.large)
                }

                Spacer()
                Text("FCX 用户脚本需使用相同端口")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 4)
    }

    private var diagnostics: some View {
        DisclosureGroup(isExpanded: $model.diagnosticsExpanded) {
            VStack(alignment: .leading, spacing: 10) {
                if model.diagnosticItems.isEmpty {
                    Label(
                        model.status == .running ? "服务运行正常，暂无需要处理的问题。" : "等待后端提供诊断结果…",
                        systemImage: model.status == .running ? "checkmark.circle.fill" : "clock"
                    )
                    .foregroundStyle(model.status == .running ? .green : .secondary)
                    .padding(.vertical, 6)
                } else {
                    ForEach(model.diagnosticItems) { item in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: item.symbol)
                                .foregroundStyle(item.color)
                                .padding(.top, 2)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(item.title).font(.callout.weight(.semibold))
                                Text(item.message).font(.callout).foregroundStyle(.secondary)
                                if !item.suggestion.isEmpty {
                                    Text("建议：\(item.suggestion)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    }
                }

                DisclosureGroup("技术详情", isExpanded: $model.technicalDetailsExpanded) {
                    VStack(alignment: .trailing, spacing: 8) {
                        ScrollView {
                            Text(model.technicalLogs.isEmpty ? "暂无技术详情" : model.technicalLogs.joined(separator: "\n"))
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(12)
                        }
                        .frame(minHeight: 90, maxHeight: 170)
                        .background(.quaternary.opacity(0.45), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        Button("复制技术详情", systemImage: "doc.on.doc") {
                            model.copyTechnicalDetails()
                        }
                    }
                    .padding(.top, 8)
                }
                .font(.callout)
            }
            .padding(.top, 10)
        } label: {
            Label("智能诊断", systemImage: "stethoscope")
                .font(.headline)
        }
        .padding(.horizontal, 4)
    }
}

@MainActor
private final class AppDelegate: NSObject, NSApplicationDelegate {
    weak var model: BackendModel?

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        model?.terminateForAppExit()
    }
}

@main
private struct FCXBackendApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = BackendModel()

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
                .task { appDelegate.model = model }
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 820, height: 760)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .newItem) { }
        }
    }
}
