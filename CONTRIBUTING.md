# Contributing to StudyDesk

感谢参与 StudyDesk！本项目是面向大学生的本地优先日程规划桌面应用（Tauri 2 + React + TypeScript + Rust）。

## 开始之前

1. 读 `README.md` 与 `docs/PROJECT-PLAN.md` 了解定位与当前进度。
2. 安装环境：Node.js 20+、Rust stable（推荐 MSVC 工具链 + WebView2）、Git。
   - 前端：`npm ci && npm run dev`
   - 桌面端：`npm run desktop:dev`（本机需项目内 `.toolchain` 或自行安装 Rust）
3. 认领一个 Issue（或先开 Issue 讨论），再来开 PR。

## 分支与提交

- 分支：`feat/<slug>`、`fix/<slug>`、`docs/<slug>`、`chore/<slug>`、`refactor/<slug>`。
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
  `feat(tasks): 支持四象限拖拽`
- 小步提交，一个 PR 只做一件事；diff ≤ 400 行。
- 同步：`git pull --rebase origin main`，禁止在 `main` 上直接提交。

## 提交前自检

```bash
npm run lint
npm run typecheck
npm test
# 涉及 Rust 改动
cargo check --manifest-path src-tauri/Cargo.toml
```

## PR

- 使用 PR 模板：说明改了什么、为什么、怎么验证、风险、截图。
- 关联 Issue：`Closes #12`。
- CI 必须全绿，至少 1 个 maintainer approve，Squash merge。
- UI 改动附截图（浅色/深色、窄窗口）。

## Issue

- 用模板（Bug / Feature）；标题前缀 `[BUG]` / `[FEAT]`。
- 标注模块标签（`area/tasks`、`area/calendar`、`area/focus`、`area/habits`、`area/review`、`area/tauri`）与优先级（`P0`–`P3`）。
- 必须挂到一个 Milestone。

## 代码约定

- TypeScript strict；ESLint + Prettier。
- 领域逻辑放 `src/domain/`，副作用放 `src/features/`，平台能力走 `PlatformPort`。
- 新增页面/模块在 `src/app/registry/registry.tsx` 注册，并补 `tests/` 单测。
- Rust 保持 `cargo fmt`、尽量 `cargo clippy` 无警告。
- 注释解释「为什么」，不复述代码。

## 数据与隐私

- 不提交真实学号/密码/课表抓包；测试用虚构数据。
- SQLite 数据库文件不提交；测试用临时目录/内存库。
- 学校账号密码只存 Windows 凭据管理器（见 `src-tauri/src/secrets.rs`）。

## 文档

- 每个版本写 `docs/vX.Y-delivery.md`（沿用现有格式）。
- 架构变更写 `docs/M*-architecture.md`；待办进 `docs/backlog.md`。
