from __future__ import annotations

import json
import os
import queue
import re
import secrets
import socket
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

import tkinter as tk
import ttkbootstrap as ttk


APP_TITLE = "FCX 本地后端"
DEFAULT_PORT = 8000
MIN_PORT = 1024
MAX_PORT = 65535
SERVICE_NAME = "fcx-backend"
COLLAPSED_GEOMETRY = "760x320"
EXPANDED_GEOMETRY = "760x560"
COLLAPSED_MIN_SIZE = (620, 300)
EXPANDED_MIN_SIZE = (620, 460)


ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
PYTHON_LOG_RE = re.compile(
    r"^(?P<timestamp>\d{4}-\d{2}-\d{2} [\d:,]+)\s+-\s+[^-]+\s+-\s+"
    r"(?P<level>DEBUG|INFO|WARNING|ERROR|CRITICAL)\s+-\s+(?P<message>.*)$"
)
UVICORN_LOG_RE = re.compile(
    r"^(?P<level>DEBUG|INFO|WARNING|ERROR|CRITICAL):\s+(?P<message>.*)$"
)
ACCESS_LOG_RE = re.compile(
    r'^(?P<client>\S+)\s+-\s+"(?P<method>[A-Z]+)\s+(?P<path>\S+)\s+'
    r'HTTP/[\d.]+"\s+(?P<status>\d{3})(?:\s+.*)?$'
)
CHINESE_LEVELS = {
    "DEBUG": "调试",
    "INFO": "信息",
    "WARNING": "警告",
    "ERROR": "错误",
    "CRITICAL": "严重错误",
}


def application_data_dir() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "FCXBackend"
    if sys.platform == "win32":
        return Path(os.getenv("LOCALAPPDATA", Path.home())) / "FCXBackend"
    return Path(os.getenv("XDG_CONFIG_HOME", Path.home() / ".config")) / "FCXBackend"


def application_log_dir() -> Path:
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Logs" / "FCXBackend"
    return application_data_dir() / "logs"


def ui_font_family() -> str:
    return "PingFang SC" if sys.platform == "darwin" else "Microsoft YaHei UI"


def monospace_font_family() -> str:
    return "Menlo" if sys.platform == "darwin" else "Consolas"


def resource_path(relative: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / relative


def settings_path() -> Path:
    return application_data_dir() / "settings.json"


def validate_port(value: object) -> int:
    try:
        port = int(str(value).strip())
    except (TypeError, ValueError) as exc:
        raise ValueError("端口必须是 1024 至 65535 的整数") from exc
    if not MIN_PORT <= port <= MAX_PORT:
        raise ValueError("端口必须是 1024 至 65535 的整数")
    return port


def load_port(path: Path | None = None) -> int:
    target = path or settings_path()
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
        return validate_port(payload.get("port"))
    except (OSError, ValueError, AttributeError, json.JSONDecodeError):
        return DEFAULT_PORT


def save_port(port: int, path: Path | None = None) -> None:
    value = validate_port(port)
    target = path or settings_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"port": value}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(temporary, target)


def local_url(port: int, path: str = "") -> str:
    return f"http://127.0.0.1:{validate_port(port)}{path}"


def server_command(port: int = DEFAULT_PORT) -> list[str]:
    arguments = ["--server", "--port", str(validate_port(port))]
    if getattr(sys, "frozen", False):
        return [sys.executable, *arguments]
    return [sys.executable, str(Path(__file__).resolve()), *arguments]


def port_is_available(port: int) -> bool:
    candidate = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            candidate.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        candidate.bind(("127.0.0.1", validate_port(port)))
        return True
    except OSError:
        return False
    finally:
        candidate.close()


def decode_process_line(raw: bytes) -> str:
    value = raw.rstrip(b"\r\n")
    try:
        return value.decode("utf-8")
    except UnicodeDecodeError:
        return value.decode("gb18030", errors="replace")


def translate_runtime_message(message: str, port: int) -> str | None:
    exact_messages = {
        "Starting server...": "正在启动本地后端…",
        "Waiting for application startup.": "正在初始化服务…",
        "Application startup complete.": "服务初始化完成",
        "Shutting down": "正在停止本地后端…",
        "Waiting for application shutdown.": "正在关闭服务…",
        "Application shutdown complete.": "服务已安全关闭",
        "Initiating graceful shutdown": "正在安全停止本地后端…",
        "Waiting for active tasks to complete": "正在等待当前求解任务结束…",
        "Some tasks didn't complete in time": "部分任务未在规定时间内结束",
        "Server stopped": "本地后端已停止",
        "Keyboard interrupt received": "收到终止指令",
        "Application terminated": "后端程序已退出",
        "Server is shutting down, rejecting new requests": "后端正在停止，已拒绝新的请求",
        "Received relay request": "收到转发请求",
    }
    if message in exact_messages:
        return exact_messages[message]

    match = re.fullmatch(r"Started server process \[(\d+)\]", message)
    if match:
        return f"后端进程已启动（PID：{match.group(1)}）"
    match = re.fullmatch(r"Finished server process \[(\d+)\]", message)
    if match:
        return f"后端进程已退出（PID：{match.group(1)}）"
    match = re.fullmatch(r"Received exit signal (\d+)", message)
    if match:
        return f"收到退出信号（{match.group(1)}）"
    match = re.fullmatch(
        r"Killing (\d+) - process will terminate immediately", message
    )
    if match:
        return f"正在强制结束后端进程（PID：{match.group(1)}）"
    match = re.fullmatch(r"Error starting server:\s*(.*)", message)
    if match:
        return f"本地后端启动失败：{match.group(1)}"
    match = re.fullmatch(
        r"Uvicorn running on (https?://\S+?)(?: \(Press CTRL\+C to quit\))?",
        message,
    )
    if match:
        return f"本地后端正在监听：{match.group(1)}"

    access = ACCESS_LOG_RE.fullmatch(message)
    if access:
        method = access.group("method")
        path = access.group("path")
        status = access.group("status")
        client = access.group("client")
        if path == "/health" and status.startswith("2"):
            return f"健康检查成功：{method} {path}（{status}，客户端 {client}）"
        return f"请求完成：{method} {path}（{status}，客户端 {client}）"

    if "Press CTRL+C to quit" in message:
        return message.replace(" (Press CTRL+C to quit)", "")
    return None


def normalize_process_log(line: str, port: int) -> str:
    cleaned = ANSI_ESCAPE_RE.sub("", line).strip()
    lowered = cleaned.lower()
    if "10048" in lowered or "address already in use" in lowered:
        return f"端口 {port} 已被占用，请更换端口或关闭占用程序"

    python_log = PYTHON_LOG_RE.fullmatch(cleaned)
    if python_log:
        translated = translate_runtime_message(python_log.group("message"), port)
        if translated is not None:
            level = CHINESE_LEVELS.get(
                python_log.group("level"), python_log.group("level")
            )
            return f'{python_log.group("timestamp")} - {level} - {translated}'

    uvicorn_log = UVICORN_LOG_RE.fullmatch(cleaned)
    if uvicorn_log:
        translated = translate_runtime_message(uvicorn_log.group("message"), port)
        if translated is not None:
            return translated

    translated = translate_runtime_message(cleaned, port)
    return translated if translated is not None else cleaned


def _parse_server_port(arguments: list[str]) -> int:
    try:
        index = arguments.index("--port")
        return validate_port(arguments[index + 1])
    except (ValueError, IndexError) as exc:
        raise SystemExit("--port 必须提供 1024 至 65535 的整数") from exc


class BackendProcessController:
    def __init__(self, messages: queue.Queue[str], port: int = DEFAULT_PORT):
        self.messages = messages
        self.port = validate_port(port)
        self.process: subprocess.Popen[bytes] | None = None
        self.shutdown_token = ""
        self.instance_token = ""
        self.last_error = ""

    @property
    def health_url(self) -> str:
        return local_url(self.port, "/health")

    @property
    def shutdown_url(self) -> str:
        return local_url(self.port, "/shutdown")

    def set_port(self, port: int) -> None:
        if self.process is not None and self.process.poll() is None:
            raise RuntimeError("后端运行时不能直接修改端口")
        self.port = validate_port(port)

    def start(self) -> bool:
        self.stop()
        self.last_error = ""
        if not port_is_available(self.port):
            self.last_error = f"端口 {self.port} 已被占用，请更换端口或关闭占用程序"
            self.messages.put(self.last_error)
            return False
        self.shutdown_token = secrets.token_urlsafe(32)
        self.instance_token = secrets.token_urlsafe(24)
        env = os.environ.copy()
        env["FCX_GUI_SHUTDOWN_TOKEN"] = self.shutdown_token
        env["FCX_GUI_INSTANCE_TOKEN"] = self.instance_token
        env["FCX_SOLVER_LOG_DIR"] = str(application_log_dir())
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        self.process = subprocess.Popen(
            server_command(self.port),
            cwd=str(Path(__file__).resolve().parent),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
            creationflags=creationflags,
        )
        threading.Thread(target=self._read_output, daemon=True).start()
        return True

    def _read_output(self) -> None:
        process = self.process
        if process is None or process.stdout is None:
            return
        for raw in process.stdout:
            line = normalize_process_log(decode_process_line(raw), self.port)
            if line:
                self.messages.put(line)
                if "端口" in line and "已被占用" in line:
                    self.last_error = line

    def healthy(self) -> bool:
        try:
            with urllib.request.urlopen(self.health_url, timeout=0.35) as response:
                payload = json.loads(response.read().decode("utf-8"))
                return (
                    response.status == 200
                    and payload.get("status") == "ok"
                    and payload.get("service") == SERVICE_NAME
                    and payload.get("port") == self.port
                    and payload.get("instance") == self.instance_token
                )
        except (OSError, ValueError, urllib.error.URLError):
            return False

    def exited(self) -> bool:
        return self.process is not None and self.process.poll() is not None

    def stop(self) -> None:
        process = self.process
        if process is None:
            return
        if process.poll() is None:
            try:
                request = urllib.request.Request(
                    self.shutdown_url,
                    method="POST",
                    headers={"X-FCX-Shutdown-Token": self.shutdown_token},
                )
                urllib.request.urlopen(request, timeout=1).close()
                process.wait(timeout=4)
            except Exception:
                process.terminate()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    process.kill()
        self.process = None


class BackendWindow:
    def __init__(self):
        self.root = ttk.Window(title=APP_TITLE, themename="flatly")
        self.root.geometry(COLLAPSED_GEOMETRY)
        self.root.minsize(*COLLAPSED_MIN_SIZE)
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        icon = resource_path("resources/ico.ico")
        if sys.platform == "darwin":
            png_icon = resource_path("resources/icon.png")
            if png_icon.exists():
                try:
                    self._window_icon = tk.PhotoImage(file=str(png_icon))
                    self.root.iconphoto(True, self._window_icon)
                except tk.TclError:
                    pass
        elif icon.exists():
            try:
                self.root.iconbitmap(str(icon))
            except tk.TclError:
                pass

        self.messages: queue.Queue[str] = queue.Queue()
        self.port = load_port()
        self.controller = BackendProcessController(self.messages, self.port)
        self.started = False
        self.logs_visible = False
        self.expanded_height = int(EXPANDED_GEOMETRY.split("x", 1)[1])
        self._build()
        self._start_backend()
        self.root.after(120, self._poll)

    def _build(self) -> None:
        shell = ttk.Frame(self.root, padding=20)
        shell.pack(fill="both", expand=True)

        heading = ttk.Frame(shell)
        heading.pack(fill="x")
        copy = ttk.Frame(heading)
        copy.pack(side="left", fill="x", expand=True)
        ttk.Label(copy, text="FCX 本地求解后端", font=(ui_font_family(), 17, "bold")).pack(anchor="w")
        self.endpoint_label = ttk.Label(copy, text="", bootstyle="secondary")
        self.endpoint_label.pack(anchor="w", pady=(4, 0))
        self.status_label = ttk.Label(heading, text="", padding=(12, 6), font=(ui_font_family(), 10, "bold"))
        self.status_label.pack(side="right")

        port_panel = ttk.Frame(shell, padding=(14, 12), bootstyle="light")
        port_panel.pack(fill="x", pady=(18, 6))
        ttk.Label(port_panel, text="本地端口", font=(ui_font_family(), 10, "bold")).pack(side="left")
        self.port_value = tk.StringVar(value=str(self.port))
        ttk.Entry(port_panel, textvariable=self.port_value, width=9).pack(side="left", padx=(14, 10))
        ttk.Button(
            port_panel,
            text="应用并重启",
            bootstyle="success",
            command=self.apply_port,
        ).pack(side="left")
        ttk.Label(
            port_panel,
            text="修改后，FCX 用户脚本端口也必须同步",
            bootstyle="warning",
        ).pack(side="right")

        toolbar = ttk.Frame(shell)
        toolbar.pack(fill="x", pady=(12, 8))
        ttk.Label(toolbar, text="详细日志", font=(ui_font_family(), 11, "bold")).pack(side="left")
        self.retry_button = ttk.Button(toolbar, text="重试启动", bootstyle="success-outline", command=self.retry, state="disabled")
        self.retry_button.pack(side="right")
        self.toggle_logs_button = ttk.Button(
            toolbar,
            text="查看详细日志",
            bootstyle="secondary-outline",
            command=self.toggle_logs,
        )
        self.toggle_logs_button.pack(side="right", padx=(0, 8))
        ttk.Button(toolbar, text="清空显示", bootstyle="secondary-outline", command=self.clear_logs).pack(side="right", padx=(0, 8))

        self.log_frame = ttk.Frame(shell)
        self.log = tk.Text(
            self.log_frame,
            wrap="word",
            state="disabled",
            bg="#ffffff",
            fg="#26343b",
            insertbackground="#26343b",
            relief="solid",
            borderwidth=1,
            font=(monospace_font_family(), 9),
        )
        scroll = ttk.Scrollbar(self.log_frame, orient="vertical", command=self.log.yview)
        self.log.configure(yscrollcommand=scroll.set)
        self.log.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")
        self._refresh_endpoint_label()

    def _refresh_endpoint_label(self) -> None:
        self.endpoint_label.configure(text=f"仅监听本机 {local_url(self.port)}")

    def _set_status(self, text: str, style: str) -> None:
        self.status_label.configure(text=text, bootstyle=f"{style}-inverse")

    def set_logs_visible(self, visible: bool) -> None:
        if self.logs_visible == visible:
            return
        self.root.update_idletasks()
        width = max(self.root.winfo_width(), COLLAPSED_MIN_SIZE[0])
        if visible:
            self.logs_visible = True
            self.root.minsize(*EXPANDED_MIN_SIZE)
            self.log_frame.pack(fill="both", expand=True)
            self.toggle_logs_button.configure(text="收起详细日志")
            self.root.geometry(f"{width}x{max(self.expanded_height, EXPANDED_MIN_SIZE[1])}")
        else:
            self.expanded_height = max(self.root.winfo_height(), EXPANDED_MIN_SIZE[1])
            self.logs_visible = False
            self.log_frame.pack_forget()
            self.toggle_logs_button.configure(text="查看详细日志")
            self.root.minsize(*COLLAPSED_MIN_SIZE)
            self.root.geometry(f"{width}x{COLLAPSED_MIN_SIZE[1] + 20}")

    def toggle_logs(self) -> None:
        self.set_logs_visible(not self.logs_visible)

    def _mark_failure(self, status: str) -> None:
        self.started = False
        self._set_status(status, "danger")
        self.retry_button.configure(state="normal")
        self.set_logs_visible(True)

    def _append(self, line: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", line + "\n")
        line_count = int(self.log.index("end-1c").split(".")[0])
        if line_count > 1200:
            self.log.delete("1.0", f"{line_count - 1000}.0")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _start_backend(self) -> None:
        self.started = False
        self.retry_button.configure(state="disabled")
        self._set_status("正在启动", "warning")
        if not self.controller.start():
            self._mark_failure("启动失败")

    def _poll(self) -> None:
        while True:
            try:
                self._append(self.messages.get_nowait())
            except queue.Empty:
                break
        if self.controller.exited():
            if self.started or self.status_label.cget("text") != "启动失败":
                self._mark_failure("启动失败")
        elif not self.started and self.controller.healthy():
            self.started = True
            self._set_status("启动成功", "success")
            self.retry_button.configure(state="disabled")
            self._append(f"本地后端启动成功：{local_url(self.port)}")
        self.root.after(180, self._poll)

    def apply_port(self) -> None:
        try:
            port = validate_port(self.port_value.get())
        except ValueError as error:
            self._append(str(error))
            self._mark_failure("端口无效")
            return
        self.controller.stop()
        self.port = port
        self.controller.set_port(port)
        save_port(port)
        self._refresh_endpoint_label()
        self._append(f"已保存端口 {port}，正在重启本地后端…")
        self._start_backend()

    def retry(self) -> None:
        self.apply_port()

    def clear_logs(self) -> None:
        self.log.configure(state="normal")
        self.log.delete("1.0", "end")
        self.log.configure(state="disabled")

    def close(self) -> None:
        self._set_status("正在停止", "secondary")
        self.root.update_idletasks()
        self.controller.stop()
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


def run_server_child(port: int) -> None:
    for name, descriptor in (("stdout", 1), ("stderr", 2)):
        if getattr(sys, name) is not None:
            continue
        try:
            stream = os.fdopen(
                os.dup(descriptor),
                "w",
                encoding="utf-8",
                errors="replace",
                buffering=1,
            )
        except OSError:
            stream = open(os.devnull, "w", encoding="utf-8")
        setattr(sys, name, stream)
    import main

    main.start(port)


if __name__ == "__main__":
    if "--server" in sys.argv:
        run_server_child(_parse_server_port(sys.argv[1:]))
    else:
        BackendWindow().run()
