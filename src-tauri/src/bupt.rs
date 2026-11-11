use std::collections::HashSet;

use chrono::{Datelike, Duration as ChronoDuration, NaiveDate};
use serde_json::{json, Value};

const BASE: &str = "https://jwglweixin.bupt.edu.cn/bjyddx";
const LOGIN_URL: &str = "https://jwglweixin.bupt.edu.cn/bjyddx/login";
const CURRICULUM_URL: &str = "https://jwglweixin.bupt.edu.cn/bjyddx/student/curriculum";
const LOGIN_PAGE: &str = "https://jwglweixin.bupt.edu.cn/sjd/#/login";
const REST_PAGE: &str = "https://jwglweixin.bupt.edu.cn/sjd/#/restClassroom";
const ORIGIN: &str = "https://jwglweixin.bupt.edu.cn";
const USER_AGENT: &str = "Mozilla/5.0";

const PERIOD_TIMES: [(&str, &str); 14] = [
    ("08:00", "08:45"),
    ("08:50", "09:35"),
    ("09:50", "10:35"),
    ("10:40", "11:25"),
    ("11:30", "12:15"),
    ("13:00", "13:45"),
    ("13:50", "14:35"),
    ("14:45", "15:30"),
    ("15:40", "16:25"),
    ("16:35", "17:20"),
    ("17:25", "18:10"),
    ("18:30", "19:15"),
    ("19:20", "20:05"),
    ("20:10", "20:55"),
];

fn code_ok(payload: &Value) -> bool {
    payload.get("code").and_then(Value::as_i64) == Some(1)
        || payload.get("code").and_then(Value::as_str) == Some("1")
}

fn text(value: &Value, key: &str) -> String {
    value
        .get(key)
        .map(|item| match item {
            Value::String(text) => text.trim().to_string(),
            Value::Number(number) => number.to_string(),
            _ => String::new(),
        })
        .unwrap_or_default()
}

fn number(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(|item| {
        item.as_f64()
            .or_else(|| item.as_str().and_then(|text| text.trim().parse::<f64>().ok()))
    })
}

fn stable_id(prefix: &str, parts: &[&str]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for part in parts {
        for byte in part.as_bytes() {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash ^= 0xff;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{prefix}-{hash:016x}")
}

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

fn headers(request: reqwest::RequestBuilder, token: Option<&str>) -> reqwest::RequestBuilder {
    let mut builder = request
        .header("Origin", ORIGIN)
        .header("Referer", REST_PAGE)
        .header("User-Agent", USER_AGENT);
    if let Some(token) = token {
        builder = builder.header("token", token);
    }
    builder
}

fn collect_course_objects(value: &Value, out: &mut Vec<Value>) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_course_objects(item, out);
            }
        }
        Value::Object(map) => {
            if map.contains_key("courseName") || map.contains_key("jx0408id") {
                out.push(value.clone());
            } else {
                for item in map.values() {
                    collect_course_objects(item, out);
                }
            }
        }
        _ => {}
    }
}

fn time_minutes(value: &str) -> Option<i64> {
    let mut parts = value.trim().split(':');
    let hour = parts.next()?.parse::<i64>().ok()?;
    let minute = parts.next()?.parse::<i64>().ok()?;
    Some(hour * 60 + minute)
}

fn period_for_time(value: &str, end: bool) -> Option<i64> {
    let target = time_minutes(value)?;
    for (index, (start, finish)) in PERIOD_TIMES.iter().enumerate() {
        let boundary = if end { time_minutes(finish) } else { time_minutes(start) };
        if let Some(boundary) = boundary {
            if target <= boundary {
                return Some(index as i64 + 1);
            }
        }
    }
    Some(14)
}

fn parse_week_numbers(course: &Value) -> Vec<i64> {
    let mut weeks: Vec<i64> = text(course, "classWeekDetails")
        .split(',')
        .filter_map(|part| part.trim().parse::<i64>().ok())
        .collect();

    if weeks.is_empty() {
        let raw = text(course, "classWeek");
        let global_odd = raw.contains('单');
        let global_even = raw.contains('双');
        let cleaned = raw.replace('单', "").replace('双', "").replace('周', "");

        for token in cleaned.split(',').map(str::trim).filter(|token| !token.is_empty()) {
            let token = token.trim_matches(|ch| matches!(ch, '[' | ']' | '(' | ')'));
            if let Some((left, right)) = token.split_once('-') {
                if let (Ok(start), Ok(end)) = (left.parse::<i64>(), right.parse::<i64>()) {
                    weeks.extend(start..=end);
                }
            } else if let Ok(value) = token.parse::<i64>() {
                weeks.push(value);
            }
        }

        if global_odd {
            weeks.retain(|week| week % 2 == 1);
        } else if global_even {
            weeks.retain(|week| week % 2 == 0);
        }
    }

    weeks.retain(|week| (1..=60).contains(week));
    weeks.sort_unstable();
    weeks.dedup();
    weeks
}

fn infer_term_start(payload: &Value) -> Option<String> {
    let root = payload.get("data")?.as_array()?.first()?;
    let dated = root
        .get("date")?
        .as_array()?
        .iter()
        .find(|item| item.get("mxrq").is_some())?;
    let week = text(dated, "zc")
        .parse::<i64>()
        .ok()
        .or_else(|| text(root, "week").parse::<i64>().ok())?;
    if week < 0 {
        return None;
    }

    let day = NaiveDate::parse_from_str(&text(dated, "mxrq"), "%Y-%m-%d").ok()?;
    let weekday = text(dated, "xqid")
        .parse::<i64>()
        .ok()
        .filter(|value| (0..=7).contains(value))
        .unwrap_or_else(|| i64::from(day.weekday().number_from_monday()));
    let weekday = if weekday == 0 { 7 } else { weekday };

    let monday = day - ChronoDuration::days(weekday - 1);
    Some(
        (monday - ChronoDuration::weeks(week - 1))
            .format("%Y-%m-%d")
            .to_string(),
    )
}

async fn post_json(
    client: &reqwest::Client,
    token: &str,
    url: &str,
) -> Result<Value, String> {
    let response = headers(client.post(url), Some(token))
        .send()
        .await
        .map_err(|_| "无法连接北邮教务，请确认网络".to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "北邮教务返回 HTTP {}",
            response.status().as_u16()
        ));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|_| "北邮教务返回了无法识别的数据".to_string())?;

    if !code_ok(&payload) {
        return Err("北邮教务登录状态失效或接口返回失败".to_string());
    }

    Ok(payload)
}

async fn fetch_timetable_with_token(
    client: &reqwest::Client,
    token: &str,
    term_name: &str,
) -> Result<Value, String> {
    let all_payload =
        post_json(client, token, &format!("{CURRICULUM_URL}?week=all")).await?;
    let current_payload = post_json(client, token, &format!("{CURRICULUM_URL}?week="))
        .await
        .ok();

    let root = all_payload
        .get("data")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| "课表返回为空".to_string())?;
    let raw_items = root
        .get("item")
        .or_else(|| root.get("courses"))
        .cloned()
        .unwrap_or(Value::Null);

    let mut raw_courses = Vec::new();
    collect_course_objects(&raw_items, &mut raw_courses);
    if raw_courses.is_empty() {
        return Err("课表返回为空".to_string());
    }

    let mut courses: Vec<Value> = Vec::new();
    let mut sessions: Vec<Value> = Vec::new();
    let mut course_ids = HashSet::new();
    let mut session_ids = HashSet::new();

    for course in &raw_courses {
        let name = text(course, "courseName");
        if name.is_empty() {
            continue;
        }

        let weekday = text(course, "weekDay")
            .parse::<i64>()
            .ok()
            .or_else(|| {
                text(course, "classTime")
                    .chars()
                    .next()
                    .and_then(|ch| ch.to_digit(10))
                    .map(i64::from)
            })
            .unwrap_or(0);
        if !(1..=7).contains(&weekday) {
            continue;
        }

        let start = period_for_time(&text(course, "startTime"), false).unwrap_or(1);
        let end = period_for_time(&text(course, "endTIme"), true)
            .unwrap_or(start)
            .max(start);
        let weeks = parse_week_numbers(course);
        if weeks.is_empty() {
            continue;
        }

        let teacher = text(course, "teacherName");
        let building = text(course, "buildingName");
        let room = text(course, "classroomName");
        let location = if !building.is_empty() && !room.is_empty() && !room.contains(&building) {
            format!("{building}-{room}")
        } else if !room.is_empty() {
            room
        } else {
            building
        };

        let source = text(course, "jx0408id");
        let course_id = stable_id("sjd-course", &[source.as_str(), name.as_str(), teacher.as_str()]);
        if course_ids.insert(course_id.clone()) {
            courses.push(json!({
                "id": course_id,
                "name": name,
                "teacher": if teacher.is_empty() { Value::Null } else { Value::String(teacher.clone()) },
                "color": format!("var(--color-course-{})", (courses.len() % 6) + 1),
            }));
        }

        let week_key = weeks
            .iter()
            .map(|week| week.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let session_id = stable_id(
            "sjd-session",
            &[
                source.as_str(),
                name.as_str(),
                &weekday.to_string(),
                &start.to_string(),
                &end.to_string(),
                week_key.as_str(),
            ],
        );
        if !session_ids.insert(session_id.clone()) {
            continue;
        }

        sessions.push(json!({
            "id": session_id,
            "courseId": course_id,
            "weekday": weekday,
            "startPeriod": start,
            "endPeriod": end,
            "weeks": weeks,
            "parity": "all",
            "location": if location.is_empty() { Value::Null } else { Value::String(location) },
        }));
    }

    if courses.is_empty() || sessions.is_empty() {
        return Err("课表没有可解析的课程".to_string());
    }

    let term_start = current_payload
        .as_ref()
        .and_then(infer_term_start)
        .unwrap_or_else(|| "2026-08-31".to_string());
    let total_weeks = raw_courses
        .iter()
        .filter_map(|course| parse_week_numbers(course).into_iter().max())
        .max()
        .unwrap_or(20)
        .max(20);

    Ok(json!({
        "meta": {
            "semester": term_name,
            "termStartDate": term_start,
            "totalWeeks": total_weeks,
        },
        "courses": courses,
        "sessions": sessions,
    }))
}

async fn request_json(
    client: &reqwest::Client,
    token: &str,
    path: &str,
    query: &[(&str, &str)],
) -> Result<Value, String> {
    let mut url = format!("{BASE}{path}");
    if !query.is_empty() {
        let suffix = query
            .iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>()
            .join("&");
        url.push('?');
        url.push_str(&suffix);
    }

    let response = headers(client.get(url), Some(token))
        .send()
        .await
        .map_err(|_| "无法连接北邮教务，请确认网络".to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "北邮教务返回 HTTP {}",
            response.status().as_u16()
        ));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|_| "北邮教务返回了无法识别的数据".to_string())?;

    if !code_ok(&payload) {
        return Err("北邮教务登录状态失效或接口返回失败".to_string());
    }

    Ok(payload)
}

pub async fn fetch_academic(
    account: &str,
    password: &str,
    cloud_password: Option<&str>,
) -> Result<Value, String> {
    let account = account.trim();
    if account.is_empty() || password.is_empty() {
        return Err("请填写学号与移动教务密码".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|_| "无法初始化网络客户端".to_string())?;

    let response = client
        .post(LOGIN_URL)
        .header("Origin", ORIGIN)
        .header("Referer", LOGIN_PAGE)
        .header("User-Agent", USER_AGENT)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(format!(
            "userNo={}&pwd={}",
            form_encode(account),
            form_encode(password)
        ))
        .send()
        .await
        .map_err(|_| "无法连接北邮教务，请确认网络".to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "北邮教务登录失败，HTTP {}",
            response.status().as_u16()
        ));
    }

    let login: Value = response
        .json()
        .await
        .map_err(|_| "北邮教务登录返回了无法识别的数据".to_string())?;

    if !code_ok(&login) {
        return Err("学号或移动教务密码不正确".to_string());
    }

    let token = login
        .get("data")
        .and_then(|data| data.get("token"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();

    if token.is_empty() {
        return Err("登录成功但未返回 token".to_string());
    }

    let term_payload = request_json(&client, &token, "/currentTerm", &[]).await?;
    let term_id = term_payload
        .get("data")
        .and_then(|data| data.get(0))
        .and_then(|data| data.get("semesterId"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    if term_id.is_empty() {
        return Err("未获取到当前学期".to_string());
    }

    let term_name = request_json(&client, &token, "/semesterList", &[])
        .await
        .ok()
        .and_then(|payload| {
            payload
                .get("data")
                .and_then(Value::as_array)
                .and_then(|items| {
                    items.iter().find(|item| {
                        item.get("semesterId").and_then(Value::as_str) == Some(term_id.as_str())
                    })
                })
                .and_then(|item| item.get("semesterName"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| term_id.clone());

    let grades_payload = request_json(
        &client,
        &token,
        "/student/termGPA",
        &[("semester", term_id.as_str()), ("type", "1")],
    )
    .await
    .unwrap_or_else(|_| json!({ "data": [{ "achievement": [] }] }));

    let achievements = grades_payload
        .get("data")
        .and_then(|data| data.get(0))
        .and_then(|data| data.get("achievement"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let grades: Vec<Value> = achievements
        .iter()
        .map(|item| {
            let course_name = text(item, "courseName");
            let course_code = text(item, "kcbh");
            let course_id = if course_code.is_empty() {
                stable_id("course", &[course_name.as_str()])
            } else {
                course_code.clone()
            };
            json!({
                "id": stable_id("grade", &[term_id.as_str(), course_code.as_str(), course_name.as_str()]),
                "courseId": course_id,
                "courseName": course_name,
                "credit": number(item, "credit").unwrap_or(0.0),
                "score": number(item, "fraction"),
                "term": term_name,
            })
        })
        .collect();

    let exams_payload = request_json(
        &client,
        &token,
        "/student/examinationArrangement",
        &[("semester", term_id.as_str())],
    )
    .await
    .unwrap_or_else(|_| json!({ "data": [] }));

    let exam_items = exams_payload
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let exams: Vec<Value> = exam_items
        .iter()
        .map(|item| {
            let course_name = text(item, "courseName");
            let location = text(item, "examinationPlace");
            let time_text = text(item, "time");
            json!({
                "id": stable_id("exam", &[term_id.as_str(), course_name.as_str(), time_text.as_str()]),
                "courseId": stable_id("course", &[course_name.as_str()]),
                "courseName": course_name,
                "title": "期末考试",
                "location": if location.is_empty() { Value::Null } else { Value::String(location) },
                "confirmed": false,
            })
        })
        .collect();

    let timetable = fetch_timetable_with_token(&client, &token, &term_name)
        .await
        .ok();

    let (assignments, cloud_error) = match cloud_password.filter(|value| !value.is_empty()) {
        Some(cloud) => match crate::ucloud::fetch_assignments(account, cloud).await {
            Ok(items) => (json!(items), Value::Null),
            Err(error) => (json!([]), Value::String(error)),
        },
        None => (json!([]), Value::String("未配置教学云密码".to_string())),
    };

    Ok(json!({
        "term": term_name,
        "grades": grades,
        "exams": exams,
        "assignments": assignments,
        "cloudError": cloud_error,
        "timetable": timetable,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn success_code_accepts_number_and_text() {
        assert!(code_ok(&json!({ "code": 1 })));
        assert!(code_ok(&json!({ "code": "1" })));
        assert!(!code_ok(&json!({ "code": 0 })));
        assert!(!code_ok(&json!({})));
    }

    #[test]
    fn stable_id_is_deterministic_and_distinct() {
        let first = stable_id("grade", &["2026-1", "C1", "线性代数"]);
        let second = stable_id("grade", &["2026-1", "C1", "线性代数"]);
        let other = stable_id("grade", &["2026-1", "C2", "线性代数"]);
        assert_eq!(first, second);
        assert_ne!(first, other);
        assert!(first.starts_with("grade-"));
    }

    #[test]
    fn number_accepts_text_and_number_but_not_text_scores() {
        assert_eq!(number(&json!({ "score": 92 }), "score"), Some(92.0));
        assert_eq!(number(&json!({ "score": "85.5" }), "score"), Some(85.5));
        assert_eq!(number(&json!({ "score": "优秀" }), "score"), None);
    }

    #[test]
    fn week_details_expand_to_numbers() {
        let course = json!({
            "classWeekDetails": ",1,2,3,6,",
            "classWeek": "1-6"
        });
        assert_eq!(parse_week_numbers(&course), vec![1, 2, 3, 6]);
    }

    #[test]
    fn class_week_parity_filters_weeks() {
        assert_eq!(
            parse_week_numbers(&json!({ "classWeek": "1-9单" })),
            vec![1, 3, 5, 7, 9]
        );
        assert_eq!(
            parse_week_numbers(&json!({ "classWeek": "2-8双" })),
            vec![2, 4, 6, 8]
        );
    }

    #[test]
    fn period_lookup_uses_time_ranges() {
        assert_eq!(period_for_time("09:50", false), Some(3));
        assert_eq!(period_for_time("12:15", true), Some(5));
        assert_eq!(period_for_time("13:00", false), Some(6));
        assert_eq!(period_for_time("20:55", true), Some(14));
    }

    #[test]
    fn current_week_infers_term_start() {
        let payload = json!({
            "data": [{
                "week": "14",
                "date": [{ "mxrq": "2026-06-01", "xqid": "1", "zc": "14" }]
            }]
        });
        assert_eq!(infer_term_start(&payload).as_deref(), Some("2026-03-02"));
    }
}