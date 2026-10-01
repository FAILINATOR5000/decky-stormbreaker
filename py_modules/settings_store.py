import threading
from pathlib import Path

from utils import load_json_file, save_json_file

DEFAULTS = {
    "stormbreaker": True,
    "automaticRecovery": True,
    "recoveryLogs": False,
}


class SettingsStore:
    def __init__(self, *, config_file: Path):
        self._config_file = config_file
        self._config_lock = threading.Lock()

    def load_config(self) -> dict:
        saved = load_json_file(self._config_file, {})
        if not isinstance(saved, dict):
            saved = {}
        return {key: bool(saved.get(key, default)) for key, default in DEFAULTS.items()}

    def update(self, key: str, value: bool) -> dict:
        with self._config_lock:
            cfg = self.load_config()
            cfg[key] = bool(value)
            save_json_file(self._config_file, cfg)
            return cfg
