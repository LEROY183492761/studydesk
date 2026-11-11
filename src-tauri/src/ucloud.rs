use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use chrono::NaiveDateTime;
use reqwest::header::{HeaderMap, HeaderValue};
use serde_json::{json, Value};

const API_ORIGIN: &str = "https://apiucloud.bupt.edu.cn";

const CAS_LOGIN_URL: &str =
    "https://auth.bupt.edu.cn/authserver/login?service=https%3A%2F%2Fucloud.bupt.edu.cn";
const CAS_SERVICE_ORIGIN: &str = "https://ucloud.bupt.edu.cn";
const CAS_SERVICE_HOST: &str = "ucloud.bupt.edu.cn";
const PORTAL_AUTHORIZATION: &str = "Basic  cG9ydGFsOnBvcnRhbF9zZWNyZXQ=";
const TENANT_ID: &str = "000000";
const USER_AGENT: &str = "StudyDesk/0.1.0";
const MAX_ASSIGNMENTS: usize = 2_000;

fn form_encode(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn attr_map(tag: &str) -> Vec<(String, String)> {
    let bytes = tag.as_bytes();
    let mut attributes = Vec::new();
    let mut index = 0;

    while index < bytes.len() {
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() {
            break;
        }

        let name_start = index;
        while index < bytes.len()
            && !bytes[index].is_ascii_whitespace()
            && bytes[index] != b'='
        {
            index += 1;
        }
        if index == name_start {
            index += 1;
            continue;
        }
        let name = String::from_utf8_lossy(&bytes[name_start..index]).to_ascii_lowercase();

        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() || bytes[index] != b'=' {
            continue;
        }
        index += 1;
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() {
            break;
        }

        let quote = match bytes[index] {
            b'"' | b'\'' => {
                let value = bytes[index];
                index += 1;
                Some(value)
            }
            _ => None,
        };
        let value_start = index;
        if let Some(quote) = quote {
            while index < bytes.len() && bytes[index] != quote {
                index += 1;
            }
        } else {
            while index < bytes.len() && !bytes[index].is_ascii_whitespace() {
                index += 1;
            }
        }
        let value = String::from_utf8_lossy(&bytes[value_start..index]).to_string();
        if quote.is_some() && index < bytes.len() {
            index += 1;
        }
        attributes.push((name, html_unescape(&value)));
    }

    attributes
}

fn html_unescape(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn parse_execution(html: &str) -> Option<String> {
    for chunk in html.split("<input").skip(1) {
        let tag = chunk.split('>').next().unwrap_or_default();
        let attributes = attr_map(tag);
        let name = attributes
            .iter()
            .find(|(name, _)| name == "name")
            .map(|(_, value)| value.as_str());
        if name == Some("execution") {
            return attributes
                .iter()
                .find(|(name, _)| name == "value")
                .map(|(_, value)| value.clone());
        }
    }
    None
}

fn cookies_from(headers: &HeaderMap) -> String {
    headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .filter_map(|value| value.split(';').next())
        .map(str::trim)
        .filter(|cookie| !cookie.is_empty())
        .collect::<Vec<_>>()
        .join("; ")
}

fn extract_ticket(location: &str) -> Option<String> {
    let base = reqwest::Url::parse(CAS_SERVICE_ORIGIN).ok()?;
    let url = base.join(location).ok()?;
    if url.scheme() != "https" || url.host_str() != Some(CAS_SERVICE_HOST) {
        return None;
    }
    url.query_pairs()
        .find(|(name, _)| name == "ticket")
        .map(|(_, value)| value.into_owned())
        .filter(|value| !value.trim().is_empty())
}

fn base_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        "Accept",
        HeaderValue::from_static("application/json, text/plain, */*"),
    );
    headers.insert("Authorization", HeaderValue::from_static(PORTAL_AUTHORIZATION));
    headers.insert("Tenant-Id", HeaderValue::from_static(TENANT_ID));
    headers.insert("User-Agent", HeaderValue::from_static(USER_AGENT));
    headers.insert(
        "Referer",
        HeaderValue::from_static("https://ucloud.bupt.edu.cn/"),
    );
    headers
}

fn text(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(text)) => text.trim().to_string(),
        Some(Value::Number(number)) => number.to_string(),
        _ => String::new(),
    }
}

fn normalize_deadline(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    if let Ok(value) = chrono::DateTime::parse_from_rfc3339(raw) {
        return Some(value.to_rfc3339());
    }
    for format in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M:%S"] {
        if let Ok(value) = NaiveDateTime::parse_from_str(raw, format) {
            return Some(value.format("%Y-%m-%dT%H:%M:%S+08:00").to_string());
        }
    }
    None
}

fn record_array(payload: &Value) -> Option<&Vec<Value>> {
    let data = payload.get("data")?;
    if let Some(items) = data.as_array() {
        return Some(items);
    }
    for key in ["records", "undoneList", "list"] {
        if let Some(items) = data.get(key).and_then(Value::as_array) {
            return Some(items);
        }
    }
    None
}

fn as_code(value: Option<&Value>) -> Option<i64> {
    match value {
        Some(Value::Number(number)) => number.as_i64(),
        Some(Value::String(value)) => value.trim().parse::<i64>().ok(),
        _ => None,
    }
}

fn submission_status(code: Option<i64>) -> &'static str {
    match code {
        Some(0) => "submitted",
        Some(1) => "graded",
        Some(99) | Some(2) => "pending",
        _ => "unknown",
    }
}

fn submission_status_text(code: Option<i64>) -> &'static str {
    match code {
        Some(0) => "已提交",
        Some(1) => "已批改",
        Some(2) => "已驳回",
        Some(99) => "未提交",
        _ => "",
    }
}

fn phase_text(code: Option<i64>) -> &'static str {
    match code {
        Some(1) => "未开始",
        Some(2) => "进行中",
        Some(3) => "已截止",
        _ => "",
    }
}

fn map_assignment(raw: &Value, fallback_course_name: Option<&str>, fallback_course_id: Option<&str>) -> Option<Value> {
    let id = text(
        raw.get("id")
            .or_else(|| raw.get("assignmentId"))
            .or_else(|| raw.get("activityId")),
    );
    let title = text(
        raw.get("assignmentTitle")
            .or_else(|| raw.get("activityName"))
            .or_else(|| raw.get("title")),
    );
    if id.is_empty() || title.is_empty() {
        return None;
    }

    let embedded_name = text(
        raw.get("siteName")
            .or_else(|| raw.get("courseName"))
            .or_else(|| raw.get("siteTitle")),
    );
    let course_name = if embedded_name.is_empty() {
        fallback_course_name.unwrap_or("未知课程").to_string()
    } else {
        embedded_name
    };
    let course_id = {
        let value = text(raw.get("siteId").or_else(|| raw.get("courseId")));
        if value.is_empty() {
            fallback_course_id.unwrap_or_default().to_string()
        } else {
            value
        }
    };

    let deadline = normalize_deadline(&text(
        raw.get("assignmentEndTime").or_else(|| raw.get("endTime")),
    ));

    let status_code = as_code(raw.get("assignmentStatus"));
    let phase_code = as_code(raw.get("status"));
    let status_text = {
        let direct = submission_status_text(status_code);
        if direct.is_empty() {
            phase_text(phase_code)
        } else {
            direct
        }
    };

    Some(json!({
        "id": id,
        "courseId": course_id,
        "courseName": course_name,
        "title": title,
        "dueAt": deadline,
        "status": submission_status(status_code),
        "statusCode": status_code,
        "statusText": status_text,
        "phaseCode": phase_code,
        "dueConfirmed": deadline.is_some(),
    }))
}

/// 作业详情正文转纯文本：保留换行，去掉标签，避免前端直接渲染远端 HTML。
fn html_to_text(html: &str) -> String {
    let mut output = String::new();
    let mut index = 0;
    let bytes = html.as_bytes();

    while index < bytes.len() {
        if bytes[index] == b'<' {
            let tag_end = html[index..].find('>').map(|offset| index + offset + 1);
            let Some(tag_end) = tag_end else {
                break;
            };
            let tag = &html[index + 1..tag_end - 1];
            let name = tag
                .trim_start_matches('/')
                .split(|value: char| value.is_ascii_whitespace() || value == '/')
                .next()
                .unwrap_or_default()
                .to_ascii_lowercase();
            if tag.starts_with('/')
                && matches!(name.as_str(), "p" | "div" | "li" | "tr" | "h1" | "h2" | "h3")
            {
                output.push('\n');
            } else if matches!(name.as_str(), "br" | "hr") {
                output.push('\n');
            }
            index = tag_end;
            continue;
        }

        let next_tag = html[index..].find('<').map(|offset| index + offset);
        let end = next_tag.unwrap_or(bytes.len());
        output.push_str(&html[index..end]);
        index = end;
    }

    let unescaped = html_unescape(&output).replace("&nbsp;", " ");
    let mut lines = Vec::new();
    let mut last_blank = false;
    for line in unescaped.lines() {
        let trimmed = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if trimmed.is_empty() {
            if !last_blank && !lines.is_empty() {
                lines.push(String::new());
            }
            last_blank = true;
            continue;
        }
        last_blank = false;
        lines.push(trimmed);
    }

    lines.join("\n").trim().to_string()
}

fn image_sources(html: &str) -> Vec<String> {
    let mut sources = Vec::new();
    for chunk in html.split("<img").skip(1) {
        let Some(tag_end) = chunk.find('>') else {
            continue;
        };
        let attributes = attr_map(&chunk[..tag_end]);
        let source = attributes
            .iter()
            .find(|(name, _)| name == "src")
            .map(|(_, value)| value.trim().to_string())
            .unwrap_or_default();
        if source.starts_with("https://") || source.starts_with("http://") || source.starts_with("//")
        {
            if !sources.contains(&source) {
                sources.push(source);
            }
        }
    }
    sources
}

fn joined_names(raw: Option<&Value>) -> String {
    match raw {
        Some(Value::String(value)) => value.trim().to_string(),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item| match item {
                Value::String(value) => value.trim().to_string(),
                Value::Object(map) => text(map.get("typeName").or_else(|| map.get("name"))),
                _ => String::new(),
            })
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
            .join("、"),
        _ => String::new(),
    }
}

fn map_attachments(raw: Option<&Value>) -> Value {
    let Some(items) = raw.and_then(Value::as_array) else {
        return json!([]);
    };

    json!(items
        .iter()
        .filter_map(|item| {
            let name = text(
                item.get("resourceName")
                    .or_else(|| item.get("fileName"))
                    .or_else(|| item.get("originalName"))
                    .or_else(|| item.get("name")),
            );
            if name.is_empty() {
                return None;
            }
            Some(json!({
                "name": name,
                "size": item.get("size").or_else(|| item.get("fileSize")).and_then(Value::as_i64),
            }))
        })
        .collect::<Vec<_>>())
}

fn map_assignment_detail(raw: &Value) -> Value {
    let content_html = raw
        .get("assignmentContent")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let assignment_type = as_code(raw.get("assignmentType"));
    let status_code = as_code(raw.get("status"));
    let full_mark = match raw.get("fullMark") {
        Some(Value::Number(number)) => number.as_f64(),
        Some(Value::String(value)) => value.trim().parse::<f64>().ok(),
        _ => None,
    };
    let allow_late = match as_code(raw.get("isOvertimeCommit")) {
        Some(0) => Some(true),
        Some(1) => Some(false),
        _ => None,
    };

    json!({
        "id": text(raw.get("id").or_else(|| raw.get("assignmentId"))),
        "title": text(raw.get("assignmentTitle")),
        "contentText": html_to_text(content_html),
        "images": image_sources(content_html),
        "beginAt": normalize_deadline(&text(
            raw.get("assignmentBeginTime").or_else(|| raw.get("beginTime")),
        )),
        "dueAt": normalize_deadline(&text(
            raw.get("assignmentEndTime").or_else(|| raw.get("endTime")),
        )),
        "className": joined_names(raw.get("className").or_else(|| raw.get("assignmentGroup"))),
        "groupName": joined_names(raw.get("groupNameList").or_else(|| raw.get("groupName"))),
        "chapterName": text(raw.get("chapterName")),
        "fullMark": full_mark,
        "allowLate": allow_late,
        "mode": match assignment_type {
            Some(0) => "单人模式",
            Some(1) => "小组模式",
            _ => "",
        },
        "statusCode": status_code,
        "statusText": phase_text(status_code),
        "attachments": map_attachments(raw.get("assignmentResource")),
    })
}

pub async fn fetch_assignment_detail(
    account: &str,
    password: &str,
    assignment_id: &str,
) -> Result<Value, String> {
    if account.trim().is_empty() || password.is_empty() {
        return Err("未配置学号或教学云密码".to_string());
    }
    let assignment_id = assignment_id.trim();
    if assignment_id.is_empty() {
        return Err("缺少作业 id".to_string());
    }

    let (client, token, _user_id) = authenticate_cached(account.trim(), password).await?;
    let payload = api_get(
        &client,
        &token,
        "/ykt-site/work/detail",
        &[("assignmentId", assignment_id.to_string())],
    )
    .await?;
    let data = payload
        .get("data")
        .filter(|value| value.is_object())
        .ok_or_else(|| "教学云作业详情格式不正确".to_string())?;

    Ok(map_assignment_detail(data))
}

async fn api_get(
    client: &reqwest::Client,
    token: &str,
    path: &str,
    query: &[(&str, String)],
) -> Result<Value, String> {
    let mut url = format!("{API_ORIGIN}{path}");
    if !query.is_empty() {
        let suffix = query
            .iter()
            .map(|(name, value)| format!("{}={}", name, form_encode(value)))
            .collect::<Vec<_>>()
            .join("&");
        url.push('?');
        url.push_str(&suffix);
    }

    let mut headers = base_headers();
    headers.insert(
        "Blade-Auth",
        HeaderValue::from_str(token).map_err(|_| "教学云令牌格式不正确".to_string())?,
    );

    let response = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(|_| "无法连接北邮教学云，请确认网络".to_string())?;
    api_response(response).await
}

async fn api_post(
    client: &reqwest::Client,
    token: &str,
    path: &str,
    body: &Value,
) -> Result<Value, String> {
    let mut headers = base_headers();
    headers.insert(
        "Blade-Auth",
        HeaderValue::from_str(token).map_err(|_| "教学云令牌格式不正确".to_string())?,
    );
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));

    let response = client
        .post(format!("{API_ORIGIN}{path}"))
        .headers(headers)
        .json(body)
        .send()
        .await
        .map_err(|_| "无法连接北邮教学云，请确认网络".to_string())?;
    api_response(response).await
}

async fn api_response(response: reqwest::Response) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(format!(
            "北邮教学云返回 HTTP {}",
            response.status().as_u16()
        ));
    }
    let payload: Value = response
        .json()
        .await
        .map_err(|_| "北邮教学云返回了无法识别的数据".to_string())?;

    let code_ok = match payload.get("code") {
        None => true,
        Some(Value::Number(number)) => number.as_i64() == Some(200),
        Some(Value::String(value)) => value == "200",
        _ => false,
    };
    if !code_ok {
        return Err("北邮教学云接口返回业务失败".to_string());
    }
    Ok(payload)
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "无法初始化教学云网络客户端".to_string())
}

const SESSION_TTL: Duration = Duration::from_secs(20 * 60);

struct CachedSession {
    account: String,
    token: String,
    user_id: String,
    expires_at: Instant,
}

fn session_cache() -> &'static Mutex<Option<CachedSession>> {
    static CACHE: OnceLock<Mutex<Option<CachedSession>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

fn cached_session(account: &str) -> Option<(String, String)> {
    let cache = session_cache().lock().ok()?;
    let entry = cache.as_ref()?;
    if entry.account != account || entry.expires_at <= Instant::now() {
        return None;
    }
    Some((entry.token.clone(), entry.user_id.clone()))
}

fn store_session(account: &str, token: &str, user_id: &str) {
    if let Ok(mut cache) = session_cache().lock() {
        *cache = Some(CachedSession {
            account: account.to_string(),
            token: token.to_string(),
            user_id: user_id.to_string(),
            expires_at: Instant::now() + SESSION_TTL,
        });
    }
}

fn clear_session() {
    if let Ok(mut cache) = session_cache().lock() {
        *cache = None;
    }
}

async fn authenticate_cached(
    account: &str,
    password: &str,
) -> Result<(reqwest::Client, String, String), String> {
    let client = build_client()?;
    if let Some((token, user_id)) = cached_session(account) {
        return Ok((client, token, user_id));
    }

    match authenticate_with(&client, account, password).await {
        Ok((token, user_id)) => {
            store_session(account, &token, &user_id);
            Ok((client, token, user_id))
        }
        Err(error) => {
            clear_session();
            Err(error)
        }
    }
}


async fn authenticate_with(
    client: &reqwest::Client,
    account: &str,
    password: &str,
) -> Result<(String, String), String> {
    let login_page = client
        .get(CAS_LOGIN_URL)
        .header("Accept", "text/html")
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|_| "无法连接北邮统一认证".to_string())?;

    if !login_page.status().is_success() {
        return Err(format!(
            "统一认证登录页返回 HTTP {}",
            login_page.status().as_u16()
        ));
    }

    let cookies = cookies_from(login_page.headers());
    if cookies.is_empty() {
        return Err("统一认证未返回有效会话 Cookie".to_string());
    }
    let html = login_page
        .text()
        .await
        .map_err(|_| "无法读取统一认证登录页".to_string())?;
    let execution = parse_execution(&html).ok_or_else(|| "统一认证登录页缺少 execution 参数".to_string())?;

    let form = format!(
        "username={}&password={}&type=username_password&execution={}&_eventId=submit",
        form_encode(account),
        form_encode(password),
        form_encode(&execution)
    );
    let login_response = client
        .post(CAS_LOGIN_URL)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Cookie", cookies)
        .header("Referer", CAS_LOGIN_URL)
        .header("User-Agent", USER_AGENT)
        .body(form)
        .send()
        .await
        .map_err(|_| "无法提交统一认证登录".to_string())?;

    let location = login_response
        .headers()
        .get("location")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let ticket = extract_ticket(location).ok_or_else(|| {
        "统一认证未返回有效票据；请检查账号密码，若官方页面要求验证码请先完成验证".to_string()
    })?;

    let token_response = client
        .post(format!("{API_ORIGIN}/ykt-basics/oauth/token"))
        .headers(base_headers())
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!(
            "ticket={}&grant_type=third",
            form_encode(&ticket)
        ))
        .send()
        .await
        .map_err(|_| "无法换取教学云访问令牌".to_string())?;

    if !token_response.status().is_success() {
        return Err(format!(
            "教学云令牌接口返回 HTTP {}",
            token_response.status().as_u16()
        ));
    }
    let token_payload: Value = token_response
        .json()
        .await
        .map_err(|_| "教学云令牌接口返回了无法识别的数据".to_string())?;
    let token = token_payload
        .get("access_token")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let user_id = text(token_payload.get("user_id").or_else(|| token_payload.get("userId")));
    if token.is_empty() || user_id.is_empty() {
        return Err("教学云令牌接口未返回访问令牌或用户标识".to_string());
    }

    Ok((token, user_id))
}

pub async fn fetch_assignments(account: &str, password: &str) -> Result<Vec<Value>, String> {
    if account.trim().is_empty() || password.is_empty() {
        return Err("未配置学号或教学云密码".to_string());
    }

    let (client, token, user_id) = authenticate_cached(account.trim(), password).await?;
    let courses_payload = api_get(
        &client,
        &token,
        "/ykt-site/site/list/student/current",
        &[
            ("size", "9999".to_string()),
            ("current", "1".to_string()),
            ("userId", user_id.clone()),
            ("siteRoleCode", "2".to_string()),
        ],
    )
    .await?;

    let courses = record_array(&courses_payload).ok_or_else(|| "教学云课程列表格式不正确".to_string())?;
    let mut assignments = Vec::new();
    let mut seen = HashSet::new();

    for course in courses {
        let course_id = text(
            course
                .get("siteId")
                .or_else(|| course.get("id"))
                .or_else(|| course.get("courseId")),
        );
        if course_id.is_empty() {
            continue;
        }
        let course_name = text(
            course
                .get("siteName")
                .or_else(|| course.get("courseName")),
        );

        let body = json!({
            "siteId": course_id,
            "userId": user_id,
            "keyword": "",
            "chapterId": "",
            "nodeId": "",
            "current": 1,
            "size": 9999,
            "studentAssignmentStatus": "",
            "status": "",
            "sortColumn": "",
            "sortType": "",
        });
        let payload = api_post(&client, &token, "/ykt-site/work/student/list", &body).await?;
        let records = record_array(&payload).ok_or_else(|| "教学云作业列表格式不正确".to_string())?;

        for record in records {
            if let Some(item) = map_assignment(
                record,
                Some(course_name.as_str()).filter(|value| !value.is_empty()),
                Some(course_id.as_str()),
            ) {
                let key = format!(
                    "{}:{}",
                    text(item.get("courseId")),
                    text(item.get("id"))
                );
                if seen.insert(key) {
                    assignments.push(item);
                }
            }
        }

        if assignments.len() >= MAX_ASSIGNMENTS {
            break;
        }
    }

    // 首页 undone 列表覆盖少量课程页遗漏的作业；失败不影响课程页结果。
    if let Ok(payload) = api_get(
        &client,
        &token,
        "/ykt-site/site/student/undone",
        &[("userId", user_id.clone())],
    )
    .await
    {
        if let Some(records) = record_array(&payload) {
            for record in records {
                if let Some(item) = map_assignment(record, None, None) {
                    let key = format!(
                        "{}:{}",
                        text(item.get("courseId")),
                        text(item.get("id"))
                    );
                    if seen.insert(key) {
                        assignments.push(item);
                    }
                }
            }
        }
    }

    Ok(assignments)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_execution_with_attribute_order_and_escapes() {
        assert_eq!(
            parse_execution(r#"<input value='e1&amp;s1' type='hidden' name='execution'>"#),
            Some("e1&s1".to_string())
        );
        assert_eq!(
            parse_execution(r#"<input name=execution value=token-2>"#),
            Some("token-2".to_string())
        );
    }

    #[test]
    fn extracts_only_trusted_ticket() {
        assert_eq!(
            extract_ticket("https://ucloud.bupt.edu.cn/?ticket=abc"),
            Some("abc".to_string())
        );
        assert_eq!(extract_ticket("https://evil.test/?ticket=abc"), None);
    }

    #[test]
    fn normalizes_deadlines() {
        assert_eq!(
            normalize_deadline("2026-12-05 23:59:00"),
            Some("2026-12-05T23:59:00+08:00".to_string())
        );
        assert_eq!(normalize_deadline(""), None);
    }

    #[test]
    fn maps_assignment_fields() {
        let raw = json!({
            "id": "a1",
            "assignmentTitle": "第三次作业",
            "assignmentEndTime": "2026-12-05 23:59:00",
            "siteName": "线性代数"
        });
        let item = map_assignment(&raw, None, None).expect("assignment");
        assert_eq!(item["title"], "第三次作业");
        assert_eq!(item["courseName"], "线性代数");
        assert_eq!(item["dueConfirmed"], true);
    }

    #[test]
    fn strips_html_into_plain_text_lines() {
        assert_eq!(
            html_to_text("<p>习题2.5 (A) 4, 8.</p><p>(B)1, 4.</p><img src='https://x/y.png'>"),
            "习题2.5 (A) 4, 8.\n(B)1, 4."
        );
        assert_eq!(html_to_text("  第一行<br>第二行&nbsp;结束  "), "第一行\n第二行 结束");
        assert_eq!(html_to_text(""), "");
    }

    #[test]
    fn extracts_only_http_image_sources() {
        assert_eq!(
            image_sources(
                "<img src='https://cdn.example/a.png'><img src='//cdn.example/b.png'><img src='javascript:alert(1)'>"
            ),
            vec![
                "https://cdn.example/a.png".to_string(),
                "//cdn.example/b.png".to_string()
            ]
        );
    }

    #[test]
    fn maps_assignment_detail_fields() {
        let raw = json!({
            "id": "a1",
            "assignmentTitle": "第十三次作业",
            "assignmentContent": "<p>习题2.5</p><p>(B)1, 4.</p>",
            "assignmentBeginTime": "2026-11-11 13:19:00",
            "assignmentEndTime": "2026-11-15 23:59:00",
            "assignmentType": 0,
            "className": "2026211109-2026211112班",
            "chapterName": "第二章",
            "fullMark": 100,
            "isOvertimeCommit": 0,
            "status": 2,
            "assignmentResource": [
                { "resourceName": "题目.pdf", "size": 2048 },
                { "fileName": "" }
            ]
        });
        let detail = map_assignment_detail(&raw);
        assert_eq!(detail["title"], "第十三次作业");
        assert_eq!(detail["contentText"], "习题2.5\n(B)1, 4.");
        assert_eq!(detail["className"], "2026211109-2026211112班");
        assert_eq!(detail["mode"], "单人模式");
        assert_eq!(detail["allowLate"], true);
        assert_eq!(detail["fullMark"], 100.0);
        assert_eq!(detail["statusText"], "进行中");
        assert_eq!(detail["attachments"][0]["name"], "题目.pdf");
        assert_eq!(detail["attachments"].as_array().map(Vec::len), Some(1));
    }

    #[test]
    fn maps_student_submission_status() {
        let raw = json!({
            "id": "a1",
            "assignmentTitle": "作业",
            "assignmentStatus": 99,
            "status": 3
        });
        let item = map_assignment(&raw, None, None).expect("assignment");
        assert_eq!(item["status"], "pending");
        assert_eq!(item["statusText"], "未提交");
        assert_eq!(item["phaseCode"], 3);
    }
}