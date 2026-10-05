import threading
from pathlib import Path

from utils import load_json_file, save_json_file, to_int

DEFAULTS = {
    "stormbreaker": True,
    "automaticRecovery": True,
    "recoveryLogs": False,
}

UPDATE_KEYS = ("updateRelease", "updateLastCheckedAt", "updateLastNotifiedTag")


class SettingsStore:
    def __init__(self, *, config_file: Path):
        self._config_file = config_file
        self._config_lock = threading.Lock()

    def _read(self) -> dict:
        saved = load_json_file(self._config_file, {})
        return saved if isinstance(saved, dict) else {}

    def _toggles(self, saved: dict) -> dict:
        return {key: bool(saved.get(key, default)) for key, default in DEFAULTS.items()}

    def _write(self, saved: dict) -> None:
        kept = {key: saved[key] for key in UPDATE_KEYS if key in saved}
        save_json_file(self._config_file, {**self._toggles(saved), **kept})

    def load_config(self) -> dict:
        return self._toggles(self._read())

    def update(self, key: str, value: bool) -> dict:
        with self._config_lock:
            saved = self._read()
            saved[key] = bool(value)
            self._write(saved)
            return self._toggles(saved)

    def load_update_check_state(self) -> dict:
        saved = self._read()
        raw = saved.get("updateRelease")
        release = None
        if isinstance(raw, dict):
            tag = str(raw.get("tag") or "").strip()
            if tag:
                release = {
                    "tag": tag,
                    "htmlUrl": str(raw.get("htmlUrl") or "").strip(),
                    "publishedAt": str(raw.get("publishedAt") or "").strip(),
                }
        return {
            "release": release,
            "lastCheckedAt": to_int(saved.get("updateLastCheckedAt", 0), 0),
            "lastNotifiedTag": str(saved.get("updateLastNotifiedTag") or "").strip(),
        }

    def save_update_release(self, release: dict, checked_at: int) -> None:
        with self._config_lock:
            saved = self._read()
            saved["updateRelease"] = {
                "tag": str(release.get("tag") or "").strip(),
                "htmlUrl": str(release.get("htmlUrl") or "").strip(),
                "publishedAt": str(release.get("publishedAt") or "").strip(),
            }
            saved["updateLastCheckedAt"] = to_int(checked_at, 0)
            self._write(saved)

    def save_update_notified_tag(self, tag: str) -> None:
        with self._config_lock:
            saved = self._read()
            saved["updateLastNotifiedTag"] = str(tag or "").strip()
            self._write(saved)
