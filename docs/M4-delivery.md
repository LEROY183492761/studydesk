# M4 交付说明（第一批）：教务数据离线导入与展示

## 1. 本轮范围

| 项 | 状态 |
|---|---|
| 教务页 `/academic` | 已完成 |
| JSON 粘贴导入（term / grades / exams / assignments） | 已完成 |
| 解析与字段校验 | 已完成 |
| 成绩、考试、作业展示 | 已完成 |
| 示例数据一键填入 | 已完成 |
| 真实北邮统一认证 / 抓取 | 后续接入 |

## 2. 实现要点

- 纯函数 `parseAcademicPayload`：校验 JSON、学期与各实体必填字段，输出 `AcademicImportPayload`；
- 成绩/考试/作业复用既有 `Grade` / `Exam` / `Assignment` 模型；
- 页面把导入结果暂存 localStorage（`studydesk.academicData`），支持清空；
- 校验失败给出明确字段错误，不覆盖已有数据；
- 作业状态在未提供时记为 `unknown`，未确认截止时间显示「未确认」。

## 3. 验证结果

| 检查 | 结果 |
|---|---|
| 前端 `typecheck` | 通过 |
| 前端 `lint` | 通过 |
| 前端 `test` | **119/119 通过**（27 个文件；截至第八批累计） |
| 前端 `build` | 通过，**476 modules**（仅单 chunk >500 kB 提示） |
| Rust `cargo test --lib` | **26/26 通过**（截至第八批累计） |

## 4. 第二批：文件导入与作业转待办

- 支持选择 `.json` 文件读取到导入框，确认后再导入；
- 作业行新增「转待办」，写入 tasks（标题、课程备注、已确认截止时间），并记录 `linkedTaskId` 防止重复转；
- 导入数据结构新增可选 `linkedTaskId`，随 JSON 持久化；
- 示例数据可直接演示文件导入与转待办链路。

## 5. 第三批：增量合并导入

- 新增 `mergeAcademicPayload`：成绩/考试/作业按 id upsert，新增项追加、已有项更新；
- 合并时保留本地作业的 `linkedTaskId`，避免重复转待办；
- 教务页新增「合并导入」按钮（无已有数据时禁用）；「导入」仍为覆盖式；
- 新增合并测试，验证更新成绩、更新作业标题并保留 `linkedTaskId`。

## 6. 第四批：真实北邮移动教务适配器（成绩/考试）

- Rust 新增 `src-tauri/src/bupt.rs`：
  - `POST https://jwglweixin.bupt.edu.cn/bjyddx/login`，表单 `userNo` / `pwd`，成功后读取 `data.token`；
  - 带 `token` 头读取 `/currentTerm`、`/semesterList`、`/student/termGPA?semester=<id>&type=1`、`/student/examinationArrangement?semester=<id>`；
  - 成绩映射课程、学分、分数；文本/空分数保持“未公布”，不误读为 0；
  - 考试映射课程与考场，时间未严格确认时不伪造。
- 前端新增「北邮在线拉取」：学号 + 移动教务密码；仅桌面端可用；
- 密码只保存在组件内存，请求结束立即清空，**不写 localStorage / SQLite / 日志**；
- 拉取成功后与已有数据增量合并并缓存；失败提示脱敏，不回显凭据或完整响应；
- 新增 3 个 Rust 单元测试（code 兼容、稳定 ID、分数解析）。

## 7. 第五批：课表真实拉取

- 复用同一登录 `token`，`POST /student/curriculum?week=all` 拉全学期课表，另用 `?week=` 推断当前周；
- 递归解析 `data[0].item` 嵌套数组中的课程对象；
- 字段：`courseName`、`teacherName`、`buildingName`/`classroomName`、`weekDay`、`startTime`/`endTIme`、`classWeek`/`classWeekDetails`、`jx0408id`；
- 周次优先使用 `classWeekDetails`，缺省时解析 `classWeek` 范围并处理「单/双」；
- 时间映射到 14 节制（09:50 → 第 3 节，12:15 → 第 5 节等）；
- 用当前周 payload 的 `mxrq` / `xqid` / `zc` 反推第一周周一；
- 结果并入 `bupt_fetch_academic` 的 `timetable`，前端拉取时同步写入课表；
- 成绩接口失败不再阻断课表返回；前端按钮改为「拉取成绩、考试与课表」；
- 新增 4 个 Rust 测试（周次展开、单双周、节次时间、学期起点）。

## 8. 个人账号设置与在线刷新（设置页）

- **教务页只保留离线导入**；原「北邮在线拉取」面板已取消，统一归到设置页；
- 设置 →「个人账号」：学号、教务密码、教学云平台密码（可选）、「使用教务密码」快捷同步；
- 默认校区：西土城 / 沙河（暂存 localStorage）；
- 「保存设置」：账号 / 教务密码 / 教学云密码写入 Windows 凭据管理器，**不写 settings.json / SQLite / localStorage**；
- 「获取/刷新个人课表」：读取已保存账号，拉取成绩 / 考试 / 课表，增量合并写入教务缓存并同步课表；
- 密码输入框不回显已保存值；Web 端明确提示仅桌面端可保存。

## 9. 第八批：作业独立模块与教学云详情

- 左侧导航新增一级「作业」页（`/assignments`），作业不再挤在教务页表格；
- 作业页能力：状态筛选（全部/未提交/已提交/已批改/已转）、截止剩余描述、逾期标记、转待办、加倒数日；
- 详情抽屉调用教学云真实接口 `GET /ykt-site/work/detail?assignmentId=<id>`（端点与字段从教学云前端产物反查确认，非猜测）；
- 详情字段映射：`assignmentTitle`、`assignmentContent`、`assignmentBeginTime`/`assignmentEndTime`、`className`/`groupNameList`、`chapterName`、`fullMark`、`isOvertimeCommit`、`assignmentType`、`assignmentResource`、`status`；
- 枚举：作业模式 `0=单人模式 / 1=小组模式`；逾期补交 `0=能 / 1=不能`；学生状态 `0=已提交 / 1=已批改 / 2=已驳回 / 99=未提交`；
- 正文 `assignmentContent` 的 HTML 由 Rust 侧转为纯文本并保留换行，同时提取 https/协议相对地址的图片，**前端不直接渲染远端 HTML**；
- 教学云会话（token/user_id）在 Rust 侧缓存 20 分钟，刷新列表与连续查看详情不再每次 CAS 登录；
- 新增命令 `bupt_fetch_assignment_detail(assignmentId)`，凭据由后端从 Windows 凭据管理器读取，前端不接触密码；
- 设置页刷新逻辑抽为共享 `refreshBuptAcademic`，设置页与作业页共用同一套凭据读取、合并与课表落库；
- 教务页移除作业表与转待办按钮，改为提示并链接到作业页；
- 新增 7 项作业规则测试、1 项状态解析测试、4 项 Rust 详情测试。

## 10. 已知限制

- 作业详情正文只保留纯文本与图片地址，远端 HTML 的表格/公式排版会退化；
- 作业附件只显示名称与大小，下载与预览未接（教学云下载走 `POST /blade-source/resource/ignore/pack/download/attachment`）；
- 详情缓存在 localStorage，不随教学云内容变化自动失效；点「刷新作业」只更新列表，不清理详情缓存；
- 作业状态依赖列表接口的 `assignmentStatus`；接口未返回时显示「未知状态」，筛选归入未提交；
- 默认校区仅保存，尚未参与空教室筛选；
- **未使用真实账号验证登录/课表/作业成功路径**：仅完成编译、单元测试与前端产物端点核对，真实登录/响应需用户本机手验；
- 课表学期起点若当前周 payload 缺失，会回退为 `2026-08-31`，可能需要手动修正；
- 账号/密码存 Windows 凭据管理器（不写 settings/SQLite/localStorage）；Web 端不支持；
- 学校登录为 HTTPS 表单提交 `userNo/pwd`，请求依赖学校接口与网络；
- 教务数据暂存 localStorage，未入 SQLite；
- 仅支持 JSON，CSV 兼容未做。

## 11. 下一步

M4 剩余：CSV 兼容、默认校区参与空教室筛选、作业附件下载、真实账号手验。