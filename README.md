# SDCC VSCode Bug Fixer

## 解决什么问题
用 PlatformIO + SDCC 开发 8051/STC 时，VS Code 的 C/C++ IntelliSense
不认识 SDCC 方言（__sbit、__sfr、__interrupt(1)、__at(0x30) 等），
满屏红线，且因 includePath 缺失触发"熔断"，连语法错误都不报。

## 它做了什么（光耦思想）
一键执行后，插件自动：
1. 生成 .vscode/sdcc_shim.h 垫片（把方言伪装成标准 C 类型）
2. 在 .vscode/settings.json 注入 forcedInclude（指向垫片）
3. 在 platformio.ini 注入 build_flags = -I<SDCC工具链include>（补全 includePath）
4. 更新 .gitignore 忽略本地配置
垫片用 #ifndef __SDCC 保护，SDCC 真编译时自动跳过 → HEX 产物零污染。

## 使用
打开含 platformio.ini 的 8051 项目 → Ctrl+Shift+P →
"SDCC: fix IntelliSense bugs" → 点"去重置"。