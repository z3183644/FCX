# FCX 本地求解后端

该服务只在用户电脑上运行，为 FCX 用户脚本提供本地 `/solve` 接口。球员池和求解请求不会通过远程 FCX API 中转。

接口结构、兼容规则和测试方法见 [开发者文档](../docs/DEVELOPMENT.md#本地后端接口)，安全边界见 [安全策略](../SECURITY.md)。

## 开发运行

```shell
python -m pip install -r requirements.txt -r requirements-build.txt
python backend/gui.py
```

默认监听 `127.0.0.1:8000`。GUI 中修改端口后，需要在 FCX 设置中使用相同端口。

桌面界面会统计 FCX 自动提交且 EA 已确认成功的 SBC 操作。阵容提交数与整组完成数分开计算，并提供今日、累计和各 SBC 明细；重复上报会按事件 ID 去重。macOS 数据保存在 `~/Library/Application Support/FCXBackend/sbc-stats.json`，不会写入应用包。诊断区默认显示自然语言结论与建议，原始运行日志仍可在“技术详情”中查看和复制。

新增的本地接口为：

- `GET /stats`：读取 SBC 统计快照。
- `POST /stats/sbc-event`：记录一条已确认事件。
- `GET /diagnostics`：读取由本地规则生成的自然语言诊断。

## 测试

```powershell
python -m pytest backend/tests -q
```

## Windows EXE

```powershell
powershell -ExecutionPolicy Bypass -File backend/build_gui.ps1
```

产物为 `dist/FCX后端.exe`。EXE 不提交到 Git；GitHub Release 工作流会和完整用户脚本一起构建、校验并上传。

## macOS 应用

```shell
./backend/build_macos.sh
```

脚本会编译原生 SwiftUI 前端，把 Python/OR-Tools 求解服务嵌入应用，并从专用的 1024 像素 Liquid Glass 图稿生成 macOS 多尺寸图标，最后按当前 Mac 的处理器架构生成 `build/macos-release/FCX后端-macOS-<架构>.zip` 及对应的 `.sha256` 文件。界面使用系统 Liquid Glass 与原生控件；旧版 macOS 自动回退到系统 Material。macOS 后端的应用版本始终与 `FCX/package.json` 中的上游 FCX 版本一致。解压后把 `FCX后端.app` 移到“应用程序”目录即可。正式 Release 分别提供 Apple Silicon (`arm64`) 和 Intel (`x86_64`) 构建。
