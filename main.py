from pathlib import Path

import decky

from settings_store import SettingsStore
from utils import chown_to_data_owner, init_data_owner


class Plugin:
    def __init__(self):
        self.settings_dir = Path(
            getattr(
                decky,
                "DECKY_PLUGIN_SETTINGS_DIR",
                "/home/deck/homebrew/settings/decky-stormbreaker",
            )
        )
        self.settings_dir.mkdir(parents=True, exist_ok=True)
        self.user_home = Path(getattr(decky, "DECKY_USER_HOME", "/home/deck"))

        init_data_owner(self.settings_dir, self.user_home)
        chown_to_data_owner(self.settings_dir)

        self.settings_store = SettingsStore(config_file=self.settings_dir / "settings.json")

    async def _main(self):
        decky.logger.info("Stormbreaker loaded")

    async def _unload(self):
        decky.logger.info("Stormbreaker unloaded")

    async def get_settings(self):
        return self.settings_store.load_config()

    async def save_stormbreaker(self, stormbreaker: bool):
        cfg = self.settings_store.update("stormbreaker", stormbreaker)

        return {
            "ok": True,
            "stormbreaker": cfg["stormbreaker"],
        }

    async def log_stormbreaker_event(self, stage=None, extra=None):
        stage_text = str(stage or "").strip() or "?"
        extra_text = str(extra or "").strip()
        decky.logger.info("stormbreaker: %s %s", stage_text, extra_text)
        return {"ok": True}
