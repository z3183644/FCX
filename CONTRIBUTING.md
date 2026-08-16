# 贡献指南

感谢你愿意改进 FCX。FCX 同时涉及 EA Web App 私有对象、本地求解器、浏览器存储和自动化写操作，贡献时必须把兼容性和用户资产安全放在代码简洁之前。

## 开始之前

提交代码前请先阅读：

- [开发者文档](docs/DEVELOPMENT.md)
- [安全策略](SECURITY.md)

如果改动涉及现有行为，建议先创建 Issue，说明：

- 当前行为。
- 期望行为。
- 使用场景。
- 会改变哪些默认值或已有设置。
- 是否涉及 EA 写请求、球员消耗或存储迁移。

安全问题不要创建公开 Issue，请按 [SECURITY.md](SECURITY.md) 私下报告。

## 可以贡献什么

- 可复现的 Bug 修复。
- EA Web App 新 build 的兼容更新。
- 类型、测试、文档和构建改进。
- 不改变安全边界的性能优化。
- SBC、卡包、挑选、进化和远控的可测试模块拆分。
- 本地求解器约束和性能优化。

以下改动通常不会接受：

- 动态下载或执行远程 JavaScript。
- 上传 EA Cookie、EA Token 或完整球员池。
- 绕过 EA 限流、验证码、封禁或平台访问控制。
- 未经授权复制第三方完整脚本或闭源代码。
- 默认关闭球员保护或在状态不确定时继续提交。
- 未经说明改变已有用户设置。

## 开发环境

用户脚本要求：

- Node.js `>=20.19.0`
- npm
- 支持 Tampermonkey 的现代浏览器

本地后端建议：

- Windows 10/11 或 macOS
- Python 3.11
- Windows 构建需要 PowerShell 5.1 或更高版本

安装依赖：

```powershell
cd FCX
npm ci

cd ..
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt -r requirements-build.txt pytest
```

## 分支和提交

建议从最新 `main` 创建短生命周期分支：

```powershell
git switch main
git pull --ff-only
git switch -c fix/short-description
```

推荐提交格式：

```text
feat(fcx): add ...
fix(sbc): prevent ...
fix(pack): recover ...
test(fcx): cover ...
docs: explain ...
build: update ...
```

一个提交应尽量只解决一个问题。不要把格式化整个仓库、功能修改和生成产物混在同一个提交中。

## TypeScript 代码规范

- 新文件必须通过严格 TypeScript 检查。
- 不要新增 `@ts-nocheck`、`@ts-ignore` 或无理由的 `any`。
- EA 私有对象先在 `src/platform` 或 `src/types` 建立最小兼容类型。
- 纯计算、解析和状态逻辑应放入有类型模块，并提供单元测试。
- 领域逻辑不要直接拼接大段 HTML。
- 外部字符串使用 `textContent` 渲染。
- Hook 必须幂等，不能重复包装或重复创建按钮。
- 新代码不要依赖兼容运行时中未声明的隐式全局变量。
- 必须支持任务取消和页面实体失效。

兼容运行时暂时允许保留 `@ts-nocheck`，但对其修改应尽量同时提取一个可测试的有类型模块。不要继续扩大这些文件。

## EA 请求规范

所有 FCX 主动发起的 EA 请求应通过现有请求执行器：

- 只读请求可以按策略重试。
- 写请求失败后必须先核验是否已成功。
- 状态无法确认时停止，不盲目重复提交、开包、移动或确认挑选。
- SBC 请求遵守共享节流和冷却。
- 不全局替换 EA 请求服务原型。
- 不让 FCX 自动任务影响 EA 原生手动页面。

## 球员保护规范

涉及 SBC 候选、阵容应用或提交的改动，必须保留三道保护：

1. 求解前候选过滤。
2. 应用阵容前检查。
3. 保存或提交前实时检查。

至少覆盖：

- 手动锁定卡型。
- 当前激活阵容实例。
- 进化球员。
- 任务执行期间保护状态变化。

保护数据读取失败时，默认行为是停止任务。

## 测试要求

用户脚本改动至少运行：

```powershell
cd FCX
npm run typecheck
npm run test
npm run build
```

发布前运行：

```powershell
npm run check
```

后端改动至少运行：

```powershell
python -m pytest backend/tests -q
```

涉及 EXE、端口或 GUI 时还应执行：

```powershell
powershell -ExecutionPolicy Bypass -File backend/build_gui.ps1
```

并启动 EXE 验证 `/health`。

涉及 macOS 应用、端口或 GUI 时还应在 Mac 上执行 `./backend/build_macos.sh`，解压生成的 ZIP，启动应用并验证 `/health`。

测试应覆盖成功、失败、取消、状态不确定和重复调用。修复 Bug 时应先添加能复现问题的测试，再验证修复。

## 存储兼容

- 新设置必须提供默认值。
- 老用户缺少字段时只能补充缺失值，不能覆盖已有值。
- 数据结构变化应有幂等迁移标记。
- 删除字段时只清理明确废弃字段。
- persona 隔离的数据不能跨账号显示。
- 远程流程和内置默认不能覆盖用户自定义流程。

## 文档要求

以下变化必须同步更新文档：

- 安装、构建或发布步骤变化。
- 新权限、新域名或新存储位置。
- API、设置或默认值变化。
- 安全边界变化。
- 用户可见的重要行为变化。
- 版本发布。

对应更新 `README.md`、`CHANGELOG.md`、[开发者文档](docs/DEVELOPMENT.md)或[用户指南](docs/USER_GUIDE.md)。

## Pull Request 清单

提交 PR 前确认：

- [ ] 改动范围单一且说明清楚。
- [ ] 没有提交 Token、Cookie、账号、日志、数据库或用户数据。
- [ ] 没有提交构建后的 EXE、`node_modules` 或临时文件。
- [ ] 新行为有测试。
- [ ] `npm run check` 通过。
- [ ] 后端改动的 Pytest 通过。
- [ ] 没有降低球员保护或写请求安全性。
- [ ] 没有新增远程代码执行能力。
- [ ] 文档和变更记录已更新。
- [ ] 已说明对老用户配置的影响。

## 许可

提交贡献即表示你有权提供这些代码，并同意贡献内容按仓库的 MIT 许可证发布。第三方代码必须保留其许可证和版权声明；无法确认授权来源的代码不会合并。
