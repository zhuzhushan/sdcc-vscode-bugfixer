const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 插件激活入口 | Extension entry point (called when the extension is activated)
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('恭喜，插件 "sdcc-vscode-bugfixer" 已激活！ | Extension "sdcc-vscode-bugfixer" is now active!');

    // 注册命令 | Register the fix command
    let disposable = vscode.commands.registerCommand('sdcc-vscode-bugfixer.fixIntellisense', function () {
        const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : null;
        if (!workspaceFolder) {
            // 双语错误提示 | Bilingual error message
            vscode.window.showErrorMessage('请先打开一个项目文件夹！ | Please open a project folder first!');
            return;
        }

        const vscodeDir = path.join(workspaceFolder, '.vscode');
        const shimFile = path.join(vscodeDir, 'sdcc_shim.h');
        const settingsFile = path.join(vscodeDir, 'settings.json');
        const platformioIniFile = path.join(workspaceFolder, 'platformio.ini');
        const gitignoreFile = path.join(workspaceFolder, '.gitignore');

        // ==========================================
        // 1. 生成垫片文件 | Generate the shim header
        //    把 SDCC 方言伪装成标准 C 类型，仅对 VS Code 生效
        //    Masquerades SDCC dialects as standard C types, VS Code only
        // ==========================================
        // 【已修复 | FIXED】include guard 宏名必须与 #ifndef 严格配对
        const shimContent = `
#ifndef __SDCC_SHIM_H__
#define __SDCC_SHIM_H__
#ifndef __SDCC
    #define __sbit   unsigned char
    #define __bit    unsigned char
    #define __sfr    unsigned char
    #define __sfr16  unsigned int
    #define __sfr32  unsigned long
    #define __idata
    #define __xdata
    #define __code
    #define __data
    #define __near
    #define __far
    #define __at(x)
    #define __interrupt(x)
    #define __using(x)
    #define __banked
    #define __reentrant
    #define __naked
    #define __critical
#endif
#endif
`;
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }
        fs.writeFileSync(shimFile, shimContent, 'utf8');

        // ==========================================
        // 2. 写入 settings.json（桥 1：forcedInclude）
        //    Bridge 1: forcedInclude via settings.json (never overwritten by PIO)
        // ==========================================
        let settings = {};
        if (fs.existsSync(settingsFile)) {
            try {
                settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            } catch (e) {
                console.error('settings.json 解析失败，将重置 | parse failed, resetting');
            }
        }
        settings["C_Cpp.default.forcedInclude"] = ["${workspaceFolder}/.vscode/sdcc_shim.h"];
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 4), 'utf8');

             // ==========================================
          // ==========================================
     // 3. 直接修改 c_cpp_properties.json（终极桥接：includePath + forcedInclude）
     //    Bridge 3: Direct injection into c_cpp_properties.json (Overrides PIO defaults)
     // ==========================================
     const cppPropertiesFile = path.join(vscodeDir, 'c_cpp_properties.json');
     
     // 调用你写好的动态探测函数
     const sdccIncludeDir = resolveSDCCIncludePath();
     
     if (!sdccIncludeDir) {
         vscode.window.showWarningMessage(
             '未找到 SDCC 头文件路径。请确认已安装 SDCC，或在 PlatformIO 项目中先编译一次以下载 toolchain-sdcc。 | SDCC headers not found. Ensure SDCC is installed, or build the PlatformIO project once to download toolchain-sdcc.'
         );
         return; // 找不到路径则中止，避免写入错误配置
     }

          // 跨平台路径变量：根据操作系统只注入生效的那一条，消除无效路径警告
     // Cross-platform: inject only the valid variable based on OS to eliminate invalid path warnings
     const homeVar = process.platform === 'win32' ? '${env:USERPROFILE}' : '${env:HOME}';
     const sdccIncludePaths = [
         "${workspaceFolder}/**",
         `${homeVar}/.platformio/packages/toolchain-sdcc/include`
     ];
     
     // 默认模板
     let cppProperties = {
         configurations: [
             {
                 name: "PlatformIO", // 匹配 PlatformIO 默认生成的配置名
                 includePath: sdccIncludePaths,
                 defines: ["__SDCC_mcs51"],
                 forcedInclude: ["${workspaceFolder}/.vscode/sdcc_shim.h"],
                 cStandard: "c89",
                 intelliSenseMode: "linux-gcc-x86",
                 compilerPath: ""
             }
         ],
         version: 4
     };

     // 如果文件已存在，读取并合并，保留用户可能的其他自定义配置
     if (fs.existsSync(cppPropertiesFile)) {
         try {
             const existing = JSON.parse(fs.readFileSync(cppPropertiesFile, 'utf8'));
             if (existing.configurations && existing.configurations.length > 0) {
                 // 找到名为 "PlatformIO" 的配置，如果没有则用第一个
                 let config = existing.configurations.find(c => c.name === "PlatformIO") || existing.configurations[0];
                 
                 // 确保数组存在
                 if (!config.includePath) config.includePath = [];
                 if (!config.forcedInclude) config.forcedInclude = [];
                 if (!config.defines) config.defines = [];

                 // 注入我们的路径和宏（去重）
                 sdccIncludePaths.forEach(p => {
                     if (!config.includePath.includes(p)) config.includePath.push(p);
                 });
                 if (!config.forcedInclude.includes("${workspaceFolder}/.vscode/sdcc_shim.h")) {
                     config.forcedInclude.push("${workspaceFolder}/.vscode/sdcc_shim.h");
                 }
                 if (!config.defines.includes("__SDCC_mcs51")) {
                     config.defines.push("__SDCC_mcs51");
                 }
                 
                 cppProperties = existing; // 使用合并后的结果
             }
         } catch (e) {
             console.error('c_cpp_properties.json 解析失败，将使用默认模板 | parse failed, using default template');
         }
     }

     // 强制写入文件
     fs.writeFileSync(cppPropertiesFile, JSON.stringify(cppProperties, null, 4), 'utf8');
     console.log('已强制更新 c_cpp_properties.json | c_cpp_properties.json forcefully updated');

     
        // ==========================================
        // 4. 更新 .gitignore（保护本地配置）
        //    Protect local configs from being committed
        // ==========================================
        let gitignoreContent = fs.existsSync(gitignoreFile) ? fs.readFileSync(gitignoreFile, 'utf8') : '';
        const ignoresToAdd = ['.vscode/settings.json', '.vscode/c_cpp_properties.json'];
        let needsUpdate = false;
        ignoresToAdd.forEach(ig => {
            if (!gitignoreContent.includes(ig)) {
                gitignoreContent += `\n${ig}`;
                needsUpdate = true;
            }
        });
        if (needsUpdate) {
            fs.writeFileSync(gitignoreFile, gitignoreContent, 'utf8');
            console.log('已更新 .gitignore | .gitignore updated');
        }

        // ==========================================
        // 5. 成功提示 + 联动重置 | Success toast + reset action
        // ==========================================
        vscode.window.showInformationMessage(
            '🎉 修复成功！已强制注入 c_cpp_properties.json + .gitignore | Fix complete! c_cpp_properties.json + .gitignore configured',
         '去重置 / Reset'   // 双语按钮 | Bilingual button label
        ).then(selection => {
            if (selection === '去重置 / Reset') {
                vscode.commands.executeCommand('C_Cpp.ResetDatabase');
            }
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

// ==========================================
// 校验某个目录是否是有效的 SDCC 头文件搜索根
// Validate whether a dir is a real SDCC include root
//   依据：SDCC 的 8051 寄存器头文件布局为 <dir>/mcs51/8051.h 或 <dir>/8051.h
//   Basis: SDCC's 8051 header lives at <dir>/mcs51/8051.h or <dir>/8051.h
// ==========================================
function hasMcs51Header(dir) {
    if (!dir || !fs.existsSync(dir)) return false;
    return fs.existsSync(path.join(dir, 'mcs51', '8051.h'))
        || fs.existsSync(path.join(dir, '8051.h'));
}

// ==========================================
// 给定一个"工具链根目录"，返回其有效的 include 搜索路径
// Given a toolchain ROOT dir, return its valid include search path
// ==========================================
function findIncludeInToolchainRoot(root) {
    // 候选布局：include/ 与 support/ 都试，兼容 PIO 包与独立 SDCC
    // Try both include/ and support/ to cover PIO package & standalone SDCC layouts
    const candidates = [
        path.join(root, 'include'),
        path.join(root, 'support'),
        path.join(root, 'sdcc', 'include'),
        path.join(root, 'sdcc', 'support'),
    ];
    for (const c of candidates) {
        if (hasMcs51Header(c)) return c;
    }
    return null;
}

// ==========================================
// 动态探测 SDCC 真实安装路径（4 级策略）
// Dynamically probe the real SDCC path (4 strategies)
// ==========================================
function resolveSDCCIncludePath() {
    // 策略 1: PlatformIO 内置工具链（你的环境命中这里）
    // Strategy 1: PlatformIO bundled toolchain (this is what your env hits)
    const pioPackages = path.join(os.homedir(), '.platformio', 'packages');
    if (fs.existsSync(pioPackages)) {
        try {
            // 匹配 toolchain-sdcc 或 toolchain-sdcc@1.40200.0 等带版本号的目录
            // Match toolchain-sdcc OR versioned dirs like toolchain-sdcc@1.40200.0
            const sdccPkgs = fs.readdirSync(pioPackages).filter(e => /^toolchain-sdcc/.test(e));
            for (const pkg of sdccPkgs) {
                const found = findIncludeInToolchainRoot(path.join(pioPackages, pkg));
                if (found) {
                    console.log('策略1命中: PlatformIO 内置 SDCC | Strategy 1 hit: PlatformIO bundled SDCC');
                    return found;
                }
            }
        } catch (e) { /* 忽略读取错误 | ignore read errors */ }
    }

    // 策略 2: 环境变量 SDCC_HOME | Strategy 2: SDCC_HOME env var
    if (process.env['SDCC_HOME']) {
        const found = findIncludeInToolchainRoot(process.env['SDCC_HOME']);
        if (found) {
            console.log('策略2命中: SDCC_HOME | Strategy 2 hit: SDCC_HOME');
            return found;
        }
    }

    // 策略 3: 探测系统 PATH 中的 sdcc | Strategy 3: probe sdcc in system PATH
    try {
        const cmd = process.platform === 'win32' ? 'where sdcc' : 'which sdcc';
        const output = require('child_process').execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
        if (output) {
            const exePath = output.split('\n')[0].trim();
            const rootDir = path.dirname(path.dirname(exePath)); // bin -> root
            const found = findIncludeInToolchainRoot(rootDir);
            if (found) {
                console.log('策略3命中: PATH 中的 sdcc | Strategy 3 hit: sdcc in PATH');
                return found;
            }
        }
    } catch (e) { /* 忽略 | ignore */ }

    // 策略 4: 独立安装的默认根目录兜底 | Strategy 4: fallback to standalone default roots
    const defaultRoots = process.platform === 'win32'
        ? ['C:\\Program Files\\SDCC', 'C:\\Program Files (x86)\\SDCC']
        : ['/usr', '/usr/local', '/opt/homebrew']; // Linux/mac 的 share/sdcc 根
    for (const r of defaultRoots) {
        // 独立 SDCC 的根可能是 <r> 或 <r>/share/sdcc
        // Standalone root may be <r> or <r>/share/sdcc
        const found = findIncludeInToolchainRoot(r) || findIncludeInToolchainRoot(path.join(r, 'share', 'sdcc'));
        if (found) {
            console.log('策略4命中: 默认安装路径 | Strategy 4 hit: default install path');
            return found;
        }
    }

    return null;
}

module.exports = {
    activate,
    deactivate
};