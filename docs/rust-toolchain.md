# Rust 工具链（项目内安装）

本机用户目录（`C:\Users\ice\.cargo`）无写权限，且未安装 Visual Studio C++ 工具，因此采用**项目内 GNU 工具链**：

```
.toolchain/
├─ rustup/          RUSTUP_HOME
├─ cargo/           CARGO_HOME（rustc / cargo / rustup）
├─ binutils/        MSYS2 binutils（as.exe / windres.exe / ar.exe 等）
├─ dlltool-shim/    dlltool 包装器 + as.exe + gcc.exe 别名
└─ rust-check/      编译验证用示例工程
```

整个 `.toolchain/` 已加入 `.gitignore`，不进入版本库。

## 1. 组件

| 组件 | 版本 | 作用 |
|---|---|---|
| rustup | 1.29.3 | 工具链管理 |
| Rust | 1.99.1（`stable-x86_64-pc-windows-gnu`） | 编译器与标准库 |
| rust-mingw | 随工具链 | 自带链接工具（`rust-lld`、`ld.exe`、`dlltool.exe`、`x86_64-w64-mingw32-gcc.exe`） |
| MSYS2 binutils | 2.47 | 提供 `as.exe`、`windres.exe` 等 |
| dlltool-wrapper | 本项目编译 | 过滤 `--temp-prefix`（Windows 下冒号导致临时文件名非法） |

## 2. 在终端使用

```bash
export RUSTUP_HOME="$PWD/.toolchain/rustup"
export CARGO_HOME="$PWD/.toolchain/cargo"
export PATH="$PWD/.toolchain/dlltool-shim:$PWD/.toolchain/cargo/bin:$PWD/.toolchain/rustup/toolchains/stable-x86_64-pc-windows-gnu/lib/rustlib/x86_64-pc-windows-gnu/bin/self-contained:$PWD/.toolchain/binutils/mingw64/bin:$PATH"
export DLLTOOL="$PWD/.toolchain/dlltool-shim/dlltool.exe"
export STUDYDESK_REAL_DLLTOOL="$PWD/.toolchain/rustup/toolchains/stable-x86_64-pc-windows-gnu/lib/rustlib/x86_64-pc-windows-gnu/bin/self-contained/dlltool.exe"

rustc --version
cargo --version
```

## 3. 通过 npm 脚本使用

`desktop:dev` / `desktop:build` 已改为 `node scripts/desktop.mjs`，自动注入工具链环境；默认使用 MSVC target，设置 `STUDYDESK_RUST_TARGET=gnu` 可切回 GNU。

## 4. 已验证

| 检查 | 结果 |
|---|---|
| `rustc --version` | 通过：1.99.1 |
| `cargo --version` | 通过：1.99.1 |
| 直接编译并运行 `hello.rs` | 通过（`-C link-self-contained=yes`） |
| `cargo build` 示例工程 | 通过 |
| Tauri 依赖编译（405 个 crate） | 通过 |
| `tauri dev` 完整构建（MSVC） | 通过：31.33s，`studydesk.exe` 已启动 |

## 5. GNU 路线遗留问题（已改用 MSVC）

以下问题只在 GNU target 下出现，当前 MSVC 路线不再遇到，保留作为回退记录：

```
'gcc' 不是内部或外部命令
windres failed to compile resource.rc ... with exit code: 0xc0000005
```

已完成的环境修补：
- 把 `x86_64-w64-mingw32-gcc.exe` 复制为 `dlltool-shim/gcc.exe`（供 `tauri-winres` 按 `gcc` 名称调用）；
- 提供 MSYS2 `windres.exe` 2.47；
- `dlltool` 通过 Rust 包装器过滤 `--temp-prefix`。

`windres --version` 单独运行正常，但编译具体 `.rc` 时返回 `0xc0000005`（访问冲突）。切到 MSVC 后不再需要这些修补。

## 6. 推荐路径：切换到 MSVC

Tauri 官方推荐 Windows 使用 MSVC，且可绕开 GNU 资源编译与 dlltool 的全部问题。需要管理员权限。

### 6.1 安装 Build Tools（管理员终端）

```powershell
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

或从 `https://aka.ms/vs/17/release/vs_BuildTools.exe` 下载安装器，勾选「使用 C++ 的桌面开发」。

### 6.2 在项目内安装 MSVC 工具链（普通终端）

```bash
export RUSTUP_HOME="$PWD/.toolchain/rustup"
export CARGO_HOME="$PWD/.toolchain/cargo"
export PATH="$PWD/.toolchain/cargo/bin:$PATH"

rustup toolchain install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc
```

### 6.3 运行

`scripts/desktop.mjs` 默认使用 MSVC target，直接执行：

```bash
npm run desktop:dev
```

如需回退 GNU，设置 `STUDYDESK_RUST_TARGET=gnu` 即可，脚本会自动注入 GNU 的 shim 与 binutils 环境。

`.cargo/config.toml` 的 `link-self-contained` 只对 GNU target 生效，可以保留作为回退，不影响 MSVC。

## 7. 已知问题

- **沙箱 DLL 钩子**：受管控终端中直接运行原生二进制可能报 `0xC0000142`；处理方式见 README。
- **winget 下载失败**：本机 winget 访问 GitHub Release 报 `InternetOpenUrl() failed`，改用 curl 从清华镜像下载。
- **用户目录无写权限**：不要使用默认 `~/.cargo`，统一使用项目内 `.toolchain`。
- **GNU 资源编译**：`windres` 2.47 在当前环境编译 `.rc` 时崩溃，尚未解决。