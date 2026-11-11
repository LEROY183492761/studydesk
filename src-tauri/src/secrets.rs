//! 学号/密码等敏感凭据的本地安全存储。
//! Windows 使用凭据管理器（与 where_to_study 相同口径）；其他平台退化为进程内存。

#[cfg(target_os = "windows")]
mod platform {
    use std::ffi::c_void;
    use std::ptr;

    use windows_sys::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND, FILETIME};
    use windows_sys::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
        CRED_TYPE_GENERIC,
    };

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn target_name(account: &str) -> Vec<u16> {
        wide(&format!("studydesk:{account}"))
    }

    pub fn save(account: &str, secret: &str) -> Result<(), String> {
        let target = target_name(account);
        let user = wide("studydesk");
        let mut blob = secret.as_bytes().to_vec();

        let credential = CREDENTIALW {
            Flags: 0,
            Type: CRED_TYPE_GENERIC,
            TargetName: target.as_ptr() as *mut u16,
            Comment: ptr::null_mut(),
            LastWritten: FILETIME {
                dwLowDateTime: 0,
                dwHighDateTime: 0,
            },
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: ptr::null_mut(),
            TargetAlias: ptr::null_mut(),
            UserName: user.as_ptr() as *mut u16,
        };

        if unsafe { CredWriteW(&credential, 0) } == 0 {
            return Err(format!(
                "保存到 Windows 凭据管理器失败（错误码 {}）",
                unsafe { GetLastError() }
            ));
        }
        Ok(())
    }

    pub fn load(account: &str) -> Option<String> {
        let target = target_name(account);
        let mut raw: *mut CREDENTIALW = ptr::null_mut();

        if unsafe { CredReadW(target.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) } == 0 {
            return None;
        }
        if raw.is_null() {
            return None;
        }

        let credential = unsafe { &*raw };
        let bytes = unsafe {
            std::slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            )
        };
        let value = String::from_utf8(bytes.to_vec()).ok();
        unsafe { CredFree(raw as *const c_void) };
        value
    }

    pub fn delete(account: &str) -> Result<(), String> {
        let target = target_name(account);
        if unsafe { CredDeleteW(target.as_ptr(), CRED_TYPE_GENERIC, 0) } == 0 {
            let code = unsafe { GetLastError() };
            if code == ERROR_NOT_FOUND {
                return Ok(());
            }
            return Err(format!(
                "删除 Windows 凭据失败（错误码 {code}）"
            ));
        }
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    fn store() -> &'static Mutex<HashMap<String, String>> {
        static STORE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(HashMap::new()))
    }

    pub fn save(account: &str, secret: &str) -> Result<(), String> {
        store()
            .lock()
            .map_err(|_| "secret store lock poisoned".to_string())?
            .insert(account.to_string(), secret.to_string());
        Ok(())
    }

    pub fn load(account: &str) -> Option<String> {
        store()
            .lock()
            .ok()?
            .get(account)
            .cloned()
    }

    pub fn delete(account: &str) -> Result<(), String> {
        store()
            .lock()
            .map_err(|_| "secret store lock poisoned".to_string())?
            .remove(account);
        Ok(())
    }
}

pub fn save(account: &str, secret: &str) -> Result<(), String> {
    platform::save(account, secret)
}

pub fn load(account: &str) -> Option<String> {
    platform::load(account)
}

pub fn delete(account: &str) -> Result<(), String> {
    platform::delete(account)
}