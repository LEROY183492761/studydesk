# StudyDesk

面向大学生的本地优先一体化日程规划应用。M0 完成脚手架与架构抽象；M1 打通日历、排期、时间轴与番茄闭环。

## 快速开始

```bash
npm install
npm run dev          # 前端开发服务器 http://localhost:5173
npm run build        # 类型检查 + 生产构建
npm run typecheck    # 仅类型检查
npm run lint         # ESLint
npm run test         # Vitest 领域规则测试
```

桌面端（项目内 Rust 工具链已就绪）：

```bash
npm run desktop:dev    # 自动注入 .toolchain 环境与 GNU target
npm run desktop:build
```

## 环境要求

- Node.js 20+（当前验证版本 24.21.0）
- Rust stable（项目内 `.toolchain`，`x86_64-pc-windows-gnu` + 自带链接器）
- WebView2（本机已安装）
- 正式发布建议另装 MSVC Build Tools 并切换 msvc 工具链，详见 `docs/rust-toolchain.md`

> 若在受管控终端或沙箱中运行，esbuild 原生二进制可能因子进程 DLL 钩子而失败（错误码 0xC0000142）。可临时清理钩子变量后执行：
>
> ```bash
> env -u SANDBOX_HOOK_DLL -u SANDBOX_HOOK_PIPE npm install
> env -u SANDBOX_HOOK_DLL -u SANDBOX_HOOK_PIPE npm run build
> ```
>
> 或使用 `npm install --ignore-scripts` 完成安装后单独验证二进制。

## 目录结构

```
src/
├─ app/           路由、布局、功能注册表、Provider
├─ features/      业务域（today / tasks / focus / settings / lab/*）
├─ domain/        纯 TS 领域层：模型、规则、选择器
├─ data/          仓储接口与本地实现、种子数据
├─ state/         Zustand 应用状态
├─ platform/      平台能力端口（Web / Tauri）
├─ lib/           日期、ID、领域事件
└─ styles/        设计 token 与页面样式
src-tauri/        Rust 桌面壳与命令占位
tests/            领域规则测试
docs/             架构说明与 v1.1 接入方案
```

## 架构要点

1. **功能注册表**：`src/app/registry/registry.tsx` 是路由与导航的唯一来源，新增模块不改核心。
2. **平台端口**：业务只依赖 `PlatformPort`，Web 与 Tauri 各自实现，v1.1 的悬浮窗、全局快捷键直接复用。
3. **仓储抽象**：`CrudRepository` 接口 + localStorage 实现，M1 替换为 SQLite 时 UI 与业务无感。
4. **领域事件**：模块间通过 `task.completed`、`focus.completed` 等事件解耦，复盘与时间轴只订阅不侵入。
5. **统一视图模型**：日历页面只消费 `CalendarItem`，课程、作业、考试、待办的合并逻辑集中在一处。

## 当前进度

- **M0**：脚手架、设计 token、三套主题、领域模型、功能注册表、平台端口、仓储抽象、领域规则测试。
- **M1**：日/周/月日历、时间轴双轨（计划层 / 实际专注层）、待办排期与取消、番茄按开始时间写回实际层。
- **M1.5**：SQLite 关系表（tasks/events/focus_sessions/notes）与 KV 迁移、前端仓储切换、Rust 番茄时钟接入、排期冲突提示、日历拖拽排期。
- **M2**：习惯打卡（连续天数、周目标、7 天格子）、随想一键转待办、日/周复盘指标与历史；关系表 v3（habits / habit_logs / reviews）。
- **v0.3.0**：任务级计时（倒计时/正计时/不计时）、番茄循环与休息、专注页快速建任务、放弃记录；schema v4。
- **v0.3.1**：待办四象限（重要性手动 + 紧急性自动 + 拖拽）、日程支持起止/持续时间、DDL ↔ 待办双向创建与删除联动；schema v5。
- **v0.3.2**：循环日程（每日/每周/每月、结束条件、星期多选、跳过本次），按区间展开不落库。
- **v0.3.3**：复盘专注分布环形图、近 12 周学习热力图（专注 / 专注+课程口径）、上期对比、最佳专注日。
- **v0.3.4**：习惯轻量/任务化双模式、打卡生成待办与时间块、取消级联删除、复盘 Markdown 复制。
- **v0.4**：DDL 改期/改标题并同步待办、月视图拖拽、任务分类（schema v6，默认 + 课程自动生成）、习惯任务化真实计时、复盘饼图按分类稳定配色、系统通知（番茄/课前/习惯）。
- **v0.5（第一～十一批）**：日/周时间轴拖拽移动、习惯编辑、分类管理（新增/改名/删除/颜色）、任务改分类与分类筛选、分类重名校验、普通日程编辑、热力图 12/26/53 周切换、通知自定义提前量、目标与倒数日（schema v7）、任务编辑、随想标签与搜索、周报 Markdown 导出/导入、循环规则编辑与单次覆盖、跨天分段、月视图落点配置、DDL 单事务写入、分类引用清理、循环/DDL 拖动、专注页快速任务分类与截止、专注秒级精度与放弃统计、循环断点续跑、通知历史、复盘情绪/睡眠记录、专注趋势图、习惯近 30 天热力图、长周期热力图自动滚动、目标关联任务与自动进度、倒数日提醒（自定义时间）、随想标签重命名/删除、今日倒数日前移与大号数字、跨实体编辑事务、闰日 2/29 处理。
- **v0.6 习惯管理优化**：同一天多次打卡与数量累计、打卡单位与同组换算、目标绑定习惯与自动进度、卡片环比指标、任务型按系统时间自动计时（结束记录本次实际持续时长、开始–结束时间段与 `1h1m` 时长）、小时单位保留两位小数、添加习惯改为按钮面板、刷新恢复计时与计时互斥提示。
- **M3（全部三批）**：课表周视图、学期创建、课程与安排手动维护；左侧节次+详细时间、当前时刻红线、今日列高亮；BUPT 示例导入；空教室手动录入与「空闲节次 ∩ 空教室」推荐。
- **M4（第一～八批）**：教务数据离线导入（JSON/文件）、展示、增量合并；真实北邮移动教务（成绩/考试/课表）与教学云作业已在线接入，账号入口统一在设置页「个人账号」，账号/密码保存到 Windows 凭据管理器；作业升级为独立「作业」页，支持状态筛选、教学云详情、转待办与加倒数日。
- 真实账号验证、CSV 兼容与作业附件下载仍在 M4 后续。          

## 文档

- [M0 架构与扩展性](docs/M0-architecture.md)
- [M1 交付说明](docs/M1-delivery.md)
- [M1.5 交付说明](docs/M1.5-delivery.md)
- [M2 交付说明](docs/M2-delivery.md)
- [v0.3.0 交付说明](docs/v0.3.0-delivery.md)
- [v0.3.1 交付说明](docs/v0.3.1-delivery.md)
- [v0.3.2 交付说明](docs/v0.3.2-delivery.md)
- [v0.3.3 交付说明](docs/v0.3.3-delivery.md)
- [v0.3.4 交付说明](docs/v0.3.4-delivery.md)
- [整体项目方案](docs/PROJECT-PLAN.md)
- [v0.4 交付说明](docs/v0.4-delivery.md)
- [v0.5 交付说明（第一～五批）](docs/v0.5-delivery.md)
- [v0.6 习惯管理优化](docs/v0.6-delivery.md)
- [v0.6 习惯管理设计](docs/v0.6-habits-design.md)
- [未来可优化清单](docs/backlog.md)
- [Rust 工具链](docs/rust-toolchain.md)
- [v1.1 增量接入方案](docs/v1.1-plan.md)