# Security Policy

## 报告漏洞

请**不要**通过公开 Issue 报告安全问题。请通过以下任一方式私下联系维护者：

- GitHub Security Advisories（仓库 → Security → Report a vulnerability）
- 邮件：`<你的邮箱>`（建议使用 GitHub 私有联系渠道）

我们会在 72 小时内确认，并在修复后公开致谢（如你愿意）。

## 支持范围

| 版本 | 支持 |
|---|---|
| 最新 release | ✅ |
| 更早版本 | 仅安全补丁，视严重程度 |

## 本项目处理的数据

- 学业账号密码：仅存 Windows 凭据管理器（`src-tauri/src/secrets.rs`），不写入普通配置文件。
- 课表/成绩/作业等：仅存本机 SQLite，不上传服务器。
- 抓包/响应样本：测试数据必须脱敏，仓库不含真实个人信息。

## 已知原则

- 不引入遥测；不向第三方上传用户数据。
- 依赖漏洞会通过 Dependabot 跟踪；请勿引入来源不明的二进制依赖。
- 若发现密钥泄露：立即 revoke、轮换、清理 git 历史，并通知协作者重新 clone。
