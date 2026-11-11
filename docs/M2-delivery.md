# M2 交付说明：习惯、随想与复盘

## 1. 本轮范围

| 项 | 状态 |
|---|---|
| 习惯 CRUD 与今日打卡 | 已完成 |
| 连续天数、周目标、7 天格子 | 已完成 |
| 随想列表与一键转待办 | 已完成 |
| 日复盘自动指标 | 已完成 |
| 周复盘聚合 | 已完成 |
| 复盘问答与历史记录 | 已完成 |
| 关系表 v3（habits / habit_logs / reviews） | 已完成并验证 |
| 旧用户习惯补种 | 已完成 |

## 2. 关系表 v3

新增三张表，`schema_version` 从 2 升到 3：

```sql
habits(id PRIMARY KEY, name, color, frequency_type, target_per_week,
       remind_at, archived, created_at, payload)

habit_logs(id PRIMARY KEY, habit_id, date, value, note, payload)
CREATE INDEX idx_habit_logs_date ON habit_logs(date);
CREATE INDEX idx_habit_logs_habit ON habit_logs(habit_id);

reviews(id PRIMARY KEY, type, period_start, period_end, created_at, payload)
CREATE INDEX idx_reviews_period ON reviews(period_start, period_end);
```

迁移逻辑：

- `migrate_kv` 依次检查 v2 / v3；
- v3 在事务内把 KV 中的 `habits / habit-logs / reviews` 导入关系表；
- 版本表记录 3，重复启动幂等。

前端 `DatabasePort` 扩展 `habits / habitLogs / reviews`：

- 桌面端走 `habit_*`、`habit_log_*`、`review_*` 共 12 个命令；
- Web 端用 localStorage 等价集合。

## 3. 习惯

领域规则 `src/domain/rules/habits.ts`：

| 函数 | 说明 |
|---|---|
| `habitStreak` | 连续天数；今天未打卡时从昨天起算，不因今天还没打卡而归零 |
| `habitWeekCount` | 本周（周一起）打卡天数 |
| `habitWeekTarget` | 每日习惯 7 天；每周习惯取 `timesPerWeek` |
| `habitWeekProgress` | 本周进度 0–1 |
| `habitTargetMet` | 是否达成周目标 |

页面 `HabitsPage`：

- 新建习惯：名称、每日/每周 N 次、颜色；
- 每个习惯展示连续天数、本周进度条、7 天格子（可补卡/取消）；
- 今日一键打卡；
- 顶部显示今日完成数 / 总数。

## 4. 随想

`NotesPage`：

- 文本框回车保存、Shift+Enter 换行；
- 列表展示内容与创建时间；
- 一键转待办：标题取内容前 40 字，正文完整保留，`source='note'`，并写回 `convertedTaskId`；
- 已转待办显示标签，避免重复转换。

## 5. 复盘

`ReviewPage`：

- 日 / 周切换与前后导航；
- 自动指标：专注分钟、专注次数、完成任务、新建任务、完成率、课程分钟、习惯达成率；
- 日指标复用 `computeDailyMetrics`；周指标由 `computeWeeklyMetrics` 逐日聚合，并给出最佳专注日；
- 三个固定问题：最值得肯定、最大干扰、接下来最重要；
- 保存后进入历史列表，可删除。

## 6. 时区修复（M1 遗留）

测试暴露出 `iso.slice(0, 10)` 取到的是 UTC 日期，与中国本地日期不一致。已统一改为 `toLocalISODate(value)`（`format(parseISO(value), 'yyyy-MM-dd')`），覆盖：

- `reviewMetrics.ts`
- `today.ts`
- `conflicts.ts` 的 `groupByDay`

修复后周复盘任务计数等指标才正确。

## 7. 验证结果

| 检查 | 结果 |
|---|---|
| 前端 `typecheck` | 通过 |
| 前端 `lint` | 通过 |
| 前端 `test` | 30/30 通过（8 个文件） |
| 前端 `build` | 通过，444 modules |
| Rust `cargo test db::tests` | 6/6 通过（迁移、CRUD、习惯、复盘） |
| 数据库 | `schema_version=3`；`habits=3`、`habit_logs=10` |
| 桌面端 | 重启后窗口正常，习惯数据已落关系表 |

## 8. 当前限制

- 习惯热力图仅展示本周 7 天，月度热力图未做。
- 随想暂无标签编辑与全文搜索。
- 复盘指标只覆盖专注/任务/课程/习惯，未纳入情绪与睡眠。
- 复盘历史未做趋势对比图。
- 习惯补种使用独立标记 `studydesk.v1.seeded.habits`，避免影响既有数据。

## 9. 下一步

1. **M3**：课表页（周视图 + 手动课程维护）、空教室页与空闲节次交集；
2. **系统通知**：番茄结束、课前提醒、习惯提醒；
3. **M4**：北邮教务适配器（课表/空教室/成绩/考试/作业）；
4. **v1.1**：间隔重复卡片、快捷录入、悬浮窗、记账。

## 10. 验收命令

```bash
npm run typecheck
npm run lint
npm run test
npm run build

export RUSTUP_HOME="$PWD/.toolchain/rustup"
export CARGO_HOME="$PWD/.toolchain/cargo"
export PATH="$PWD/.toolchain/cargo/bin:$PATH"
export RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc
cargo test --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc

python scripts/check-db.py
```