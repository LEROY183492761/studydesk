# M1：日程、排期与时间轴闭环

## 1. 目标与范围

M1 的目标是把 M0 的静态页面补成可用的最小闭环：

```
待办 → 排期 → 日程/周视图可见 → 番茄执行 → 时间轴实际层 → 可与计划层对照
```

本轮交付**前端可验证部分**。受本机缺少 Rust 工具链限制，SQLite 仓储与 Rust 番茄时钟列为 M1.5。

## 2. 交付清单

| 层 | 内容 |
|---|---|
| 领域 | `selectors/calendar.ts`（范围、42 天月网格、课程展开、条目合并、几何定位）、`selectors/timeline.ts`（双轨输出与时长统计）、`rules/schedule.ts`（排期、取消、冲突） |
| 数据 | 新增 `ScheduleEvent` 仓储与 `studydesk.v1.events` 持久化键；种子日程 3 条 |
| 状态 | `events` 集合、`addEvent` / `removeEvent` / `scheduleTask` / `unscheduleTask`；`toggleTask` 完成后恢复到 `planned` 而非 `inbox` |
| 页面 | `CalendarPage`（日/周/月）、`TimeGrid`、`MonthGrid`、`TimelinePage`、待办页内联排期表单 |
| 样式 | `styles/schedule.css`：时间网格、月网格、双轨时间轴、排期表单 |
| 测试 | `tests/calendar.test.ts`：网格边界、条目合并、排期与冲突、双轨统计 |

## 3. 关键设计

### 3.1 统一条目模型

日历页不直接读课程表、事件表、任务表，只消费 `buildCalendarItems()` 的产物 `CalendarItem[]`：

- 课程：按教学周与星期展开，只读；
- 日程：`ScheduleEvent` 转为日历项，可删除；
- 待办：仅 `scheduledStart/End` 存在且未完成时进入日历。

这样后续接入作业 DDL、考试、自定义订阅源时，只需在合并函数里加一个 mapper。

### 3.2 双轨时间轴

`buildTimeline()` 输出同一 `TimelineItem` 类型的两个层：

- `planned`：课程、日程、排期待办；
- `actual`：`FocusSession`，起点为点击“开始”的时刻，长度取实际秒数。

页面用两列同刻度的时间轴并排展示，并在侧栏计算计划总时长、实际专注、偏差和次数。这为 M2 复盘提供客观指标，不依赖用户主观回忆。

### 3.3 排期规则

`applySchedule()` 把任务状态改为 `planned`，结束时间由“开始时间 + 时长（最少 5 分钟）”计算；`clearSchedule()` 回退到 `inbox`。`scheduleConflicts()` 复用 M0 的区间重叠函数，供后续“排期时提示冲突”使用。

### 3.4 时间轴与番茄的边界

M1 的番茄仍在 Web 侧计时，但写入 `startedAt` 为首次点击开始的时间，避免“结束时才记录”导致实际层整体后移。暂停时间计入当前段专注，M1.5 迁移 Rust 时钟后再做暂停扣除。

## 4. 验收标准

| 项 | 通过标准 | 方式 |
|---|---|---|
| 日历 | 日/周/月切换正常；课程、日程、排期待办同时可见 | 手动 + 领域测试 |
| 排期 | 待办可排期/取消；排期后出现在日历与时间轴计划层 | 手动 |
| 番茄 | 完成后实际层出现在时间轴，起点正确 | 手动 |
| 持久化 | 刷新后任务、日程、专注记录仍在 | 手动 |
| 工程 | `typecheck` / `lint` / `test` / `build` 全部通过 | 命令 |

## 5. 限制与 M1.5

- 仍未迁移 SQLite：`RepositoryBundle` 接口已稳定，替换实现即可。
- 番茄计时仍在前端：休眠漂移与暂停扣除留待 Rust 时钟。
- 日历暂不处理跨天事件与全天事件布局：`allDay` 字段已预留。
- 排期冲突目前只提供函数，未在 UI 中阻断；M1.5 在确认排期时提示。
- 未做拖拽排期：先保证表单排期的正确性，拖拽在 M1.5 与日历一起打磨。