# FCX macOS 自用维护版（非官方）

> 这是面向 macOS 用户的非官方维护版本，并非原作者在 Greasy Fork 上发布的官方 FCX 脚本。

本脚本基于 **一阵失心风** 开源的 FCX 项目继续维护：

- 原作者：一阵失心风（GitHub：`z3183644`）
- 原项目：[z3183644/FCX](https://github.com/z3183644/FCX)
- macOS 维护者：`titi14gj`
- macOS 源码：[titi14gj/FCX](https://github.com/titi14gj/FCX)
- 开源许可证：MIT

## 与原版的区别

- 提供原生 macOS 后端和符合 macOS 风格的 Liquid Glass 界面。
- 显示今日及累计 SBC 完成数量，并区分 FCX 确认完成与 EA 页面观察数据。
- 浏览器暂时无法连接本地后端时，会保存待上报事件并在恢复连接后补报。
- SBC 自动化停止时，在 macOS 后端弹出提醒并显示自然语言停止原因。
- 将求解和连接诊断转换成普通用户更容易理解的说明。

## 使用说明

1. 安装 Tampermonkey 或 Violentmonkey。
2. 从本页面安装用户脚本。
3. 从 [GitHub Releases](https://github.com/titi14gj/FCX/releases) 下载对应架构的 macOS 后端。
4. 先启动 macOS 后端，再打开 EA FC Ultimate Team Web App。

本维护版与原版使用不同的脚本名称和命名空间，可以同时安装；但不建议同时启用，以免两个脚本同时操作 EA Web App。

## 网络和隐私说明

- SBC 求解默认只访问本机 `127.0.0.1` 上运行的 FCX 后端。
- 球员价格功能会按需访问脚本中列出的价格服务。
- 原 FCX 的账号与小程序远程控制属于可选功能。只有用户主动注册并登录后，脚本才会连接 `fc.fczhushou.com`，发送设备状态、任务状态、目录和运行日志，以提供远程控制能力。
- 如果启用通知功能，脚本可能访问 `ntfy.sh`。
- 本维护版不隶属于 Electronic Arts，也未获得 Electronic Arts 授权。

问题反馈请提交至：[titi14gj/FCX Issues](https://github.com/titi14gj/FCX/issues)
