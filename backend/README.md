# FCX 本地求解后端

该服务只在用户电脑上运行，为 FCX 用户脚本提供本地 `/solve` 接口。球员池和求解请求不会通过远程 FCX API 中转。

接口结构、兼容规则和测试方法见 [开发者文档](../docs/DEVELOPMENT.md#本地后端接口)，安全边界见 [安全策略](../SECURITY.md)。

## 开发运行

```shell
python -m pip install -r requirements.txt -r requirements-build.txt
python backend/gui.py
```

默认监听 `127.0.0.1:8000`。GUI 中修改端口后，需要在 FCX 设置中使用相同端口。

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

脚本会编译原生 SwiftUI 前端，把 Python/OR-Tools 求解服务嵌入应用，并从专用的 1024 像素 Liquid Glass 图稿生成 macOS 多尺寸图标，最后按当前 Mac 的处理器架构生成 `build/macos-release/FCX后端-macOS-<架构>.zip` 及对应的 `.sha256` 文件。界面使用系统 Liquid Glass 与原生控件；旧版 macOS 自动回退到系统 Material。解压后把 `FCX后端.app` 移到“应用程序”目录即可。正式 Release 分别提供 Apple Silicon (`arm64`) 和 Intel (`x86_64`) 构建。

macOS 客户端需要使用独立版本号时，可执行 `FCX_MACOS_VERSION=0.1.0 ./backend/build_macos.sh`；未设置时沿用 FCX 主项目版本。
