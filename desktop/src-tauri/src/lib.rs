use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_opener::OpenerExt;

const CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+9";

// Set UPLOAD_API_BASE at build/run time to point at the deployed web/ app
// (e.g. `UPLOAD_API_BASE=https://your-app.vercel.app cargo tauri dev`).
fn upload_api_base() -> String {
    std::env::var("UPLOAD_API_BASE").unwrap_or_else(|_| "http://localhost:3000".to_string())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
enum CaptureStatus {
    Capturing,
    Uploading,
    Done { share_url: String },
    Cancelled,
    Error { message: String },
}

#[derive(Deserialize)]
struct UploadResponse {
    url: String,
}

fn emit_status(app: &AppHandle, status: CaptureStatus) {
    let _ = app.emit("capture-status", status);
}

async fn capture_and_share(app: AppHandle) {
    emit_status(&app, CaptureStatus::Capturing);

    let tmp_path = std::env::temp_dir().join(format!(
        "screenshot-app-{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));

    // `-i` opens macOS's interactive region/window selector. If the user
    // cancels (Escape), screencapture exits successfully but writes no file.
    let spawn_result = std::process::Command::new("screencapture")
        .arg("-i")
        .arg(&tmp_path)
        .status();

    let captured = match spawn_result {
        Ok(status) if status.success() => tmp_path.exists(),
        Ok(_) => false,
        Err(err) => {
            emit_status(
                &app,
                CaptureStatus::Error {
                    message: format!("Failed to run screencapture: {err}"),
                },
            );
            return;
        }
    };

    if !captured {
        emit_status(&app, CaptureStatus::Cancelled);
        return;
    }

    let bytes = match std::fs::read(&tmp_path) {
        Ok(bytes) => bytes,
        Err(err) => {
            emit_status(
                &app,
                CaptureStatus::Error {
                    message: format!("Failed to read screenshot: {err}"),
                },
            );
            return;
        }
    };
    let _ = std::fs::remove_file(&tmp_path);

    emit_status(&app, CaptureStatus::Uploading);

    let part = match reqwest::multipart::Part::bytes(bytes)
        .file_name("screenshot.png")
        .mime_str("image/png")
    {
        Ok(part) => part,
        Err(err) => {
            emit_status(
                &app,
                CaptureStatus::Error {
                    message: format!("Failed to build upload request: {err}"),
                },
            );
            return;
        }
    };
    let form = reqwest::multipart::Form::new().part("file", part);

    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/api/upload", upload_api_base()))
        .multipart(form)
        .send()
        .await;

    let upload = match response {
        Ok(res) if res.status().is_success() => res.json::<UploadResponse>().await,
        Ok(res) => {
            emit_status(
                &app,
                CaptureStatus::Error {
                    message: format!("Upload failed with status {}", res.status()),
                },
            );
            return;
        }
        Err(err) => {
            emit_status(
                &app,
                CaptureStatus::Error {
                    message: format!("Upload failed: {err}"),
                },
            );
            return;
        }
    };

    let share_path = match upload {
        Ok(body) => body.url,
        Err(err) => {
            emit_status(
                &app,
                CaptureStatus::Error {
                    message: format!("Unexpected upload response: {err}"),
                },
            );
            return;
        }
    };

    let share_url = format!("{}{}", upload_api_base(), share_path);

    if let Err(err) = app.opener().open_url(share_url.clone(), None::<String>) {
        emit_status(
            &app,
            CaptureStatus::Error {
                message: format!("Captured and uploaded, but couldn't open the browser: {err}"),
            },
        );
        return;
    }

    emit_status(&app, CaptureStatus::Done { share_url });
}

#[tauri::command]
async fn capture_now(app: AppHandle) {
    capture_and_share(app).await;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let global_shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app = app.clone();
                tauri::async_runtime::spawn(capture_and_share(app));
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(global_shortcut_plugin)
        .invoke_handler(tauri::generate_handler![capture_now])
        .setup(|app| {
            app.global_shortcut().register(CAPTURE_SHORTCUT)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
