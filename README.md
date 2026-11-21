# SDCC VSCode Bug Fixer

> 一键修复 SDCC 方言在 VS Code 中的 IntelliSense 红线，零污染编译产物。
> One-click fix for SDCC dialect IntelliSense errors in VS Code, with zero impact on compiled output.

---

## 🇬🇧 English

### What problem does it solve?
When developing 8051/STC with **PlatformIO + SDCC**, VS Code's C/C++ IntelliSense does not recognize SDCC dialects (`__sbit`, `__sfr`, `__interrupt(1)`, `__at(0x30)`, etc.), producing a wall of false-positive errors. Worse, a missing `includePath` triggers a "circuit-breaker" that suppresses *real* syntax errors too.

### How it works 
The extension isolates the editor from the compiler — it "tricks" VS Code without ever touching the build:

1. Generates `.vscode/sdcc_shim.h` — masquerades SDCC dialects as standard C types.
2. Injects `forcedInclude` into `.vscode/settings.json` (never overwritten by PlatformIO).
3. Injects `build_flags = -I<SDCC toolchain include>` into `platformio.ini` (survives Rebuild).
4. Updates `.gitignore` to keep local configs out of version control.

The shim is wrapped in `#ifndef __SDCC`, so the real SDCC compiler skips it entirely → **HEX output is bit-for-bit identical** (verified via SHA256 hash comparison).

### Usage
Open an 8051 project containing `platformio.ini` → `Ctrl+Shift+P` → **"SDCC: fix IntelliSense bugs"** → click **"Reset"**.

### Known limitations
- Targets SDCC dialects only; does not add SDCC syntax highlighting (semantic highlighting is preserved instead).
- Assumes the SDCC toolchain is installed at the default PlatformIO path (`~/.platformio/packages/toolchain-sdcc/include`).

### About 3rd-party Libraries & Manual Projects
- This extension is designed for PlatformIO + SDCC environments, based on the "opto-coupler" philosophy. Understanding its boundaries helps you manage projects better:

### If you use PlatformIO:
- The extension automatically handles SDCC standard headers. PlatformIO itself manages 3rd-party libraries (via lib_deps), and VS Code's default scanner handles local headers in your src folder. No extra action is needed.

### If you use pure manual Makefiles or external libraries:
- The extension only injects the default SDCC toolchain path. If you place 3rd-party libraries in custom directories (e.g., D:\MyLibs), VS Code's IntelliSense won't find them automatically. You need to manually add those paths to .vscode/c_cpp_properties.json (includePath) or .vscode/settings.json (C_Cpp.default.includePath). To make sure SDCC's compilation doesn't get messed up, the extension intentionally does not touch these configurations.


### License
MIT

---

## 🇨🇳 中文

### 解决什么问题？
用 **PlatformIO + SDCC** 开发 8051/STC 时，VS Code 的 C/C++ IntelliSense 不认识 SDCC 方言（`__sbit`、`__sfr`、`__interrupt(1)`、`__at(0x30)` 等），满屏红线；且因 `includePath` 缺失触发"熔断"，连真正的语法错误都不报。

### 它做了什么
把"编辑器"和"编译器"隔离开——只骗 VS Code 的眼睛，绝不碰编译：

1. 生成 `.vscode/sdcc_shim.h` 垫片，把方言伪装成标准 C 类型。
2. 在 `.vscode/settings.json` 注入 `forcedInclude`（PlatformIO 不会覆盖它）。
3. 在 `platformio.ini` 注入 `build_flags = -I<SDCC 工具链 include>`（Rebuild 后依然有效）。
4. 更新 `.gitignore`，把本地配置挡在版本控制之外。

垫片用 `#ifndef __SDCC` 保护，SDCC 真编译时自动跳过 → **HEX 产物逐字节一致**（已用 SHA256 哈希比对验证）。

### 使用
打开含 `platformio.ini` 的 8051 项目 → `Ctrl+Shift+P` → **"SDCC: fix IntelliSense bugs"** → 点 **"去重置"**。

### 已知限制
- 仅处理 SDCC 方言，不添加 SDCC 语法高亮（保留系统语义高亮）。
- 假设 SDCC 工具链装在 PlatformIO 默认路径 `~/.platformio/packages/toolchain-sdcc/include`。

### 关于第三方库与手动项目 
- 本插件专为 PlatformIO + SDCC 环境设计，核心思想是“光耦隔离”。理解它的边界，能让你更好地管理项目：

### 如果你使用 PlatformIO 
插件会自动处理 SDCC 标准头文件。PlatformIO 自身会管理第三方库（通过 lib_deps），而 VS Code 默认扫描器能识别 src 目录下的本地头文件。无需额外操作。

### 如果你使用纯手动 Makefile 或外部库 | 
- 插件仅注入默认的 SDCC 工具链路径。如果你将第三方库放在自定义目录（如 D:\MyLibs），VS Code 的 IntelliSense 无法自动找到它们。你需要手动将这些路径添加到 .vscode/- - c_cpp_properties.json（includePath）或 .vscode/settings.json（C_Cpp.default.includePath）。为了保证不污染SDCC的编译，插件故意不干预这些配置。


### 许可
MIT