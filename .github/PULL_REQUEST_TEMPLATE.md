# Pull Request

## 改动内容

<!-- 一句话说明这个 PR 做了什么 -->

## 为什么

<!-- 关联 Issue：Closes #12；或说明动机 -->

## 怎么验证

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] （涉及 Rust）`cargo check --manifest-path src-tauri/Cargo.toml`
- [ ] 手动冒烟：涉及页面/交互的已实际点过

## 截图 / 录屏

<!-- UI 改动必填：浅色 + 深色 / 窄窗口 -->

## 风险与回滚

<!-- 数据迁移、schema 变更、兼容性影响；如何回滚 -->

## 检查清单

- [ ] 一个 PR 只做一件事（diff ≤ 400 行）
- [ ] 没有提交密钥、`.env`、构建产物、`node_modules`、`target`
- [ ] 新增领域规则有单测
- [ ] 文档/版本号已同步（如需要）
- [ ] 已 self-review 一遍 diff
