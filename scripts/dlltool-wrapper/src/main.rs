use std::env;
use std::process::Command;

/// 过滤 GNU dlltool 在 Windows 上不适用的 --temp-prefix 参数。
/// 该参数值以冒号结尾（如 kernel32.dll:），会被 Windows 解释为非法文件名，
/// 导致 dlltool 生成的临时目标文件找不到。
fn main() {
    let mut filtered = Vec::new();
    let mut skip_next = false;

    for arg in env::args().skip(1) {
        if skip_next {
            skip_next = false;
            continue;
        }
        if arg == "--temp-prefix" {
            skip_next = true;
            continue;
        }
        if arg.starts_with("--temp-prefix=") {
            continue;
        }
        filtered.push(arg);
    }

    let real = env::var("STUDYDESK_REAL_DLLTOOL").unwrap_or_else(|_| "dlltool.exe".to_string());
    let status = Command::new(real)
        .args(filtered)
        .status()
        .expect("failed to launch real dlltool");

    std::process::exit(status.code().unwrap_or(1));
}