# 一阵失心风 FCX

> 本仓库基于原作者 [z3183644](https://github.com/z3183644) 开源的
> [FCX](https://github.com/z3183644/FCX) 继续开发。本分支新增 macOS 原生
> SwiftUI/Liquid Glass 客户端及配套构建支持；原项目名称、作者署名、MIT
> 许可证和上游地址均予以保留。

FCX 是面向 EA SPORTS FC Ultimate Team Web App 的 Tampermonkey 用户脚本，提供本地 SBC 求解、自动 SBC、永动机流程、球员保护、奖励处理、PlayStyle DIY 进化和小程序远程控制。

## 文档

- [用户指南](docs/USER_GUIDE.md)：安装、兼容性、功能说明、常见问题和故障排查。
- [开发者文档](docs/DEVELOPMENT.md)：架构、本地接口、测试、构建和发布。
- [隐私说明](docs/PRIVACY.md)：本地数据、远程账号和第三方请求边界。
- [Greasy Fork 公开说明](docs/GREASYFORK_DESCRIPTION.md)：macOS 非官方维护版的署名、差异和网络说明。
- [贡献指南](CONTRIBUTING.md)：分支、代码规范、测试要求和 Pull Request 清单。
- [安全策略](SECURITY.md)：安全边界和私密漏洞报告方式。
- [变更记录](CHANGELOG.md)：当前及历史版本的重要变化。
- [支持项目](SPONSOR.md)：自愿支持 FCX 的持续维护。

## 仓库内容

- `FCX/`：TypeScript 源码、测试、构建脚本和本地流程配置。
- `backend/`：只监听本机的 SBC 求解服务、桌面 GUI 和后端测试。
- `dist/`：本地生成的完整用户脚本、后端 EXE、静态 JSON 和校验文件。
- `.github/workflows/`：FCX 类型检查、测试和构建验证。

本仓库不包含远程 API 服务端、小程序、数据库或用户数据。后端 EXE 不直接提交到 Git；版本标签会由 GitHub Actions 从源码构建并与用户脚本一起发布。

## 开发与验证

需要 Node.js 20.19 或更高版本。

```powershell
cd FCX
npm ci
npm run check
```

`npm run check` 会依次运行 TypeScript 检查、完整测试、用户脚本构建、单文件校验和发布产物校验。

为 Greasy Fork 生成具有独立名称、命名空间和更新源的公开维护版：

```shell
cd FCX
npm run build:greasyfork
```

产物位于 `FCX/greasyfork/FCX-macOS.user.js`。该文件保持非压缩形式并提交到 Git，供 Greasy Fork 源码同步使用；它不会覆盖原版 `FCX.js`。

后端验证和本机构建：

```shell
python -m pip install -r requirements.txt -r requirements-build.txt
python -m pytest backend/tests -q
# Windows
powershell -ExecutionPolicy Bypass -File backend/build_gui.ps1
# macOS
./backend/build_macos.sh
```

构建产物位于：

```text
FCX/dist/FCX.js
dist/FCX.js
dist/FCX后端.exe
build/macos-release/FCX后端-macOS-arm64.zip
build/macos-release/FCX后端-macOS-x86_64.zip
dist/routines.json
dist/version.json
dist/SHA256SUMS.txt
```

根目录 `dist/` 保存用户脚本和 Windows 发布文件，`build/macos-release/` 保存本机生成的 macOS 压缩包；两者都已被 Git 忽略，由构建流程生成并通过 GitHub Release 发布，不应手动提交。

## 安全边界

- 用户脚本只连接声明过的 EA、FCX 主站和本机求解器地址。
- SBC 球员池和求解请求只发送给本机 `127.0.0.1` 求解器。
- 脚本不会从主站下载或动态执行 JavaScript。
- `version.json` 和 `routines.json` 仅用于版本提醒与声明式流程配置。

详细的数据存储与远程同步范围见 [隐私说明](docs/PRIVACY.md)。

## Fork 与自建静态地址

官方发行版默认从 `https://fczhushou.com/fcx/` 读取版本和永动机流程。该域名由 FCX 维护者管理，公开仓库不代表任何贡献者或 Fork 维护者可以向官方主站上传文件。

Fork 项目应把 `version.json`、`routines.json` 部署到自己的 HTTPS 域名，并按 [开发者文档](docs/DEVELOPMENT.md#自定义静态-json-地址) 修改两个地址和 Tampermonkey `@connect` 白名单。

## 问题反馈

- 普通 Bug 和功能建议请使用 GitHub Issue。
- 提交前请先搜索已有 Issue，并按 [用户指南的故障排查章节](docs/USER_GUIDE.md#故障排查) 收集环境和第一条相关错误。
- 安全问题不要创建公开 Issue，请按 [安全策略](SECURITY.md) 私下报告。
- 不要公开提交密码、Token、Cookie、Authorization 请求头、persona ID 或完整球员池。

FCX 由个人维护，不保证即时回复。信息完整、影响明确且能稳定复现的问题会优先处理。

## 许可证与致谢

项目以 MIT 许可证发布。FCX 的原作者和上游项目为
[z3183644/FCX](https://github.com/z3183644/FCX)；FCX 又基于
[titiroMonkey/Auto-SBC](https://github.com/titiroMonkey/Auto-SBC) 继续开发，详细说明见 [NOTICE.md](NOTICE.md)。

EA SPORTS FC、Ultimate Team 及相关标识归其权利人所有，本项目与 Electronic Arts 无隶属或授权关系。
