# M0 架构与扩展性设计

## 1. 技术选型

| 层 | 选型 | 理由 | 备选与取舍 |
|---|---|---|---|
| UI | React 19 + TypeScript + Vite | 生态成熟、类型安全、与借鉴项目桌面端同路线 | 纯 Web 可先跑通，但系统能力弱；Flutter 一致性好但生态与人才成本高 |
| 桌面壳 | Tauri 2 | 体积小、系统通知/托盘/密钥库可直达、后续可扩移动端 | Electron 生态成熟但包体大、内存高 |
| 状态 | Zustand | 轻量、按域拆分成本低、无 Provider 嵌套 | Redux Toolkit 约束强但样板多；Jotai 适合细粒度原子状态 |
| 数据查询 | TanStack Query | 教务缓存、刷新与失败重试语义清晰 | 纯手写 hooks 会重复实现缓存与竞态处理 |
| 本地数据 | 仓储接口 + localStorage（M0）→ SQLite（M1） | M0 零原生依赖即可验证；接口不变可平滑替换 | 直接写 SQLite 需要 Rust 构建链，阻塞 M0 |
| 日期 | date-fns | 按需引入、函数式、教学周计算直观 | Day.js 体积更小但插件生态分散 |
| 样式 | CSS 变量 + 手写样式 | 主题 token 化、无额外构建链、可控性强 | Tailwind 开发快但与设计规范强绑定；组件库会限制风格 |
| 测试 | Vitest + 领域纯函数测试 | 与 Vite 同配置、启动快 | Jest 配置更重 |

## 2. 模块划分

```
app/        应用装配层：路由、布局、Provider、功能注册表
features/   业务域：today / tasks / focus / settings / lab（v1.1 预留）
domain/     纯领域层：models（数据契约）/ rules（可计算规则）/ selectors（派生视图）
data/       数据访问层：仓储接口、本地实现、种子数据
state/      应用状态：Zustand store 与动作
platform/   平台能力：PlatformPort 定义 + Web/Tauri 实现
lib/        通用工具：日期、ID、领域事件
styles/     设计 token、主题、页面样式
```

依赖方向固定为：`app → features → domain`、`features → data/state/platform`，`domain` 不依赖任何上层，`lib` 不依赖 React。

## 3. 扩展点设计

### 3.1 功能注册表（模块解耦）

`src/app/registry/registry.tsx` 是路由与导航的唯一来源。模块只需实现 `FeatureModule`：

```ts
interface FeatureModule {
  id: string;
  title: string;
  path: string;
  icon: string;
  group: 'core' | 'extension' | 'lab';
  order: number;
  element: ReactNode;
  nav: boolean;
  flag?: keyof FeatureFlags;
  commands?: CommandContribution[];
  widgets?: WidgetContribution[];
}
```

- `router.tsx` 由 `routeEntries()` 派生，`AppShell` 由 `navFeatures()` 派生。
- `flag` 让未完成模块可注册但默认不可见，避免“半成品入口”。
- `commands` / `widgets` 为后续命令面板与今日页挂件预留，不需要改核心布局。

**适用场景**：功能持续增加、需要灰度开关、后期想接入“实验室”。
**优势**：新增模块只改一个注册文件；导航与路由不会漂移。
**局限**：注册表是运行时聚合，缺少编译期“所有模块已注册”的强约束。缓解方式是给注册表加唯一性测试与 id 常量。

### 3.2 平台端口（接口抽象）

`src/platform/types.ts` 定义 `PlatformPort`：storage、clipboard、notification、timer、windowControl、shortcuts、secrets。
业务只依赖接口，`web.ts` 与 `tauri.ts` 各自实现，`getPlatform()` 按 `__TAURI_INTERNALS__` 选择。

**适用场景**：同一套业务跑 Web 与桌面；v1.1 悬浮窗、全局快捷键、系统通知。
**优势**：能力差异集中在一个文件，业务不写 `if (isTauri)`。
**局限**：多一层间接与少量样板代码；Web 端能力缺失时必须显式降级。

### 3.3 仓储抽象（数据访问隔离）

`CrudRepository<T>` 与专用仓储接口定义在 `data/repositories/types.ts`。
M0 用 `createRepositoryBundle(KeyValuePort)` 注入 localStorage，M1 换成 SQLite 实现即可，UI 与 store 不改。

**适用场景**：从 localStorage 迁移 SQLite、未来接云同步、测试注入内存实现。
**优势**：数据层可替换、可测试；迁移风险集中在实现层。
**局限**：跨仓储事务需要额外设计（M1 用 SQLite transaction 处理）；过早抽象会增加文件数量。

### 3.4 领域事件（模块间解耦）

`src/lib/events.ts` 用类型化事件表约束事件名与载荷。番茄完成、任务完成、随想捕获都发事件，复盘与时间轴订阅。

**适用场景**：番茄 → 时间轴、任务 → 复盘、录入 → 下游模块。
**优势**：避免模块互相 import；新增订阅方不改发布方。
**局限**：事件链是隐式的，排障需要日志或事件追踪；不适合强一致的业务约束。

### 3.5 配置与灰度

`AppSettings.flags` 定义四个 v1.1 功能开关，设置页可直接切换。
新增开关只需扩展 `FeatureFlags` 与设置页列表，注册表自动生效。

### 3.6 路由与状态

- 路由使用 `createHashRouter`，适配 Tauri 的 `file://` 加载，避免深链接 404。
- 状态按域拆分：M0 的 `appStore` 已按 tasks/notes/focus/settings 分区，M1 建议拆为 `taskStore`、`focusStore` 等 slice，避免单 store 膨胀。
- 服务端数据（教务缓存）走 TanStack Query，不塞进 Zustand。

## 4. 方案对比

| 维度 | A. 功能域分包 + 注册表 + 端口（采用） | B. 经典三层全局分层 | C. 插件沙箱 / 微前端 |
|---|---|---|---|
| 组织方式 | `features/<domain>` 自治，核心只做装配 | `components/`、`services/`、`hooks/` 按技术角色分层 | 每个模块独立构建、运行时加载 |
| 实现成本 | 低：一个目录 + 一个注册项 | 最低：初期无需抽象 | 高：构建、通信、类型共享、版本管理 |
| 维护成本 | 低：按域定位，删除模块只删目录与注册项 | 中高：跨域改动会同时触碰多层目录，易形成隐式耦合 | 高：调试链路长，依赖与沙箱版本需持续维护 |
| 可扩展性 | 高：注册表 + flag + 端口 | 中：新增功能容易复制粘贴，长期耦合上升 | 很高：天然隔离，可独立发布 |
| 适用场景 | 单人/小团队、功能持续迭代、需要灰度 | 页面型项目、短期交付 | 多团队、插件市场、第三方扩展 |
| 主要风险 | 注册表缺乏编译期约束；跨域逻辑需下沉 domain | 业务边界随规模扩大而模糊 | 过度工程，M0 阶段成本不可接受 |

**推荐 A**。理由：当前是单人起步、功能面宽且会持续增加，A 用最小代价获得“新增模块不改核心”的能力；同时端口与仓储抽象已经覆盖多端与数据迁移两个最大变量。C 只有在出现多团队并行或第三方插件需求时才值得引入；B 适合一次性页面项目，不适合长期演进。

## 5. 实际适用性与局限

**适用**
- 每周新增一个功能域，但不希望每次改路由、导航与布局。
- 需要先做 Web 原型、后补 Tauri 桌面能力。
- 教务接口不稳定，需要 Mock 与真实实现随时切换。

**优势**
- 新增模块的改动面可预测：目录、注册表、仓储（可选）、迁移（可选）。
- 失败隔离：单个模块异常不阻塞应用启动；教务适配器失败可降级缓存。
- 测试成本低：domain 是纯函数，规则可单测。

**局限**
- 过度抽象风险：如果每个小功能都建端口与仓储，文件数会快速膨胀。约定“只有跨平台或跨存储的能力才建端口”。
- 事件总线隐式依赖：需要事件命名规范与调试日志，否则排障困难。
- 注册表运行时聚合：缺少编译期校验，需要测试兜底。
- M0 的 localStorage 仓储不适合大数据量与并发写，M1 必须迁移 SQLite。

## 6. 编码规范与依赖约定

- TypeScript `strict`，禁止 `any` 进入提交（ESLint 会提示）。
- 领域层禁止 import React、Zustand、平台实现。
- 跨域共享逻辑放 `domain/` 或 `lib/`，禁止 feature 之间直接 import。
- 新增依赖前先评估：能否用现有依赖或标准库实现；领域规则优先自研，避免黑盒。
- 提交前执行：`npm run typecheck && npm run lint && npm run test && npm run build`。

## 7. M0 交付物与验收标准

| 交付物 | 验收方式 | 通过标准 |
|---|---|---|
| 工程配置 | `npm run typecheck` | 0 类型错误 |
| 前端构建 | `npm run build` | 生成 `dist/`，无构建错误 |
| 领域规则 | `npm run test` | 教学周、重复规则、今日聚合、复盘指标、快捷解析全部通过 |
| 代码规范 | `npm run lint` | 0 error |
| 可运行页面 | `npm run dev` | 今日/待办/专注/设置可交互；刷新后数据保持 |
| 主题与开关 | 设置页 | 三套主题即时生效；四个 v1.1 开关可切换且入口联动 |
| 桌面壳 | 安装 Rust 后 `npm run desktop:dev` | 窗口启动，`PlatformPort` 走 Tauri 实现（待环境验证） |
| 文档 | `docs/` | 架构、扩展点、v1.1 接入方案齐全 |