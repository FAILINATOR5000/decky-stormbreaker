import asyncio
from pathlib import Path

import decky

from freeze_capture import clear_captures
from freeze_incidents_store import INCIDENT_EVENT, FreezeIncidentsStore
from freeze_watchdog_service import FreezeWatchdogService
from session_mode_service import SessionModeService
from settings_store import SettingsStore
from update_checker_service import UpdateCheckerService
from utils import chown_to_data_owner, init_data_owner, set_write_roots, ssl_context

UPDATE_FOUND_EVENT = "stormbreaker_update_found"


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
        self.runtime_dir = Path(
            getattr(
                decky,
                "DECKY_PLUGIN_RUNTIME_DIR",
                "/home/deck/homebrew/data/decky-stormbreaker",
            )
        )
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.user_home = Path(getattr(decky, "DECKY_USER_HOME", "/home/deck"))

        init_data_owner(self.settings_dir, self.user_home)
        chown_to_data_owner(self.settings_dir)
        chown_to_data_owner(self.runtime_dir)
        set_write_roots(self.settings_dir, self.runtime_dir)
        self._asyncio_loop = None

        self.settings_store = SettingsStore(config_file=self.settings_dir / "settings.json")
        self.freeze_incidents_store = FreezeIncidentsStore(
            base_dir=self.runtime_dir,
            on_change=self._emit_freeze_incident,
        )
        self.session_mode_service = SessionModeService(
            on_change=lambda: self.freeze_watchdog_service.sync(),
        )
        self.freeze_watchdog_service = FreezeWatchdogService(
            settings_store=self.settings_store,
            user_home=self.user_home,
            game_mode=self.session_mode_service.is_game_mode,
            incidents=self.freeze_incidents_store,
        )
        self.update_checker_service = UpdateCheckerService(
            settings_store=self.settings_store,
            ssl_context=ssl_context(),
            on_found=self._emit_update_found,
            game_mode=self.session_mode_service.is_game_mode,
        )

    async def _main(self):
        self.session_mode_service.start()
        self._asyncio_loop = asyncio.get_running_loop()
        decky.logger.info("Stormbreaker loaded")
        self.freeze_watchdog_service.sync()
        self.update_checker_service.start()

    async def _unload(self):
        self.session_mode_service.stop()
        self.freeze_watchdog_service.stop()
        self.update_checker_service.stop()
        decky.logger.info("Stormbreaker unloaded")

    def _emit_freeze_incident(self) -> None:
        loop = self._asyncio_loop
        if loop is None:
            return
        asyncio.run_coroutine_threadsafe(decky.emit(INCIDENT_EVENT, {}), loop)

    def _emit_update_found(self, version: str) -> None:
        loop = self._asyncio_loop
        if loop is None:
            return
        asyncio.run_coroutine_threadsafe(decky.emit(UPDATE_FOUND_EVENT, {"version": version}), loop)

    async def get_settings(self):
        response = dict(self.settings_store.load_config())
        response["gameMode"] = self.session_mode_service.refresh(from_frontend=True)
        self.update_checker_service.frontend_arrived()
        return response

    async def get_plugin_version(self):
        return str(getattr(decky, "DECKY_PLUGIN_VERSION", ""))

    async def save_stormbreaker(self, stormbreaker: bool):
        cfg = self.settings_store.update("stormbreaker", stormbreaker)

        return {
            "ok": True,
            "stormbreaker": cfg["stormbreaker"],
        }

    async def save_automatic_recovery(self, automatic_recovery: bool):
        cfg = self.settings_store.update("automaticRecovery", automatic_recovery)
        self.freeze_watchdog_service.sync()

        return {
            "ok": True,
            "automaticRecovery": cfg["automaticRecovery"],
        }

    async def save_recovery_logs(self, recovery_logs: bool):
        cfg = self.settings_store.update("recoveryLogs", recovery_logs)
        self.freeze_watchdog_service.sync()

        return {
            "ok": True,
            "recoveryLogs": cfg["recoveryLogs"],
        }

    async def clear_recovery_logs(self):
        removed = await asyncio.to_thread(clear_captures)
        decky.logger.info("freeze capture: cleared %d recovery log folder(s)", removed)

        return {
            "ok": True,
            "removed": removed,
        }

    async def log_stormbreaker_event(self, stage=None, extra=None):
        stage_text = str(stage or "").strip() or "?"
        extra_text = str(extra or "").strip()
        decky.logger.info("stormbreaker: %s %s", stage_text, extra_text)
        return {"ok": True}

    async def record_storm_broken(self, record=None):
        entry_id = self.freeze_incidents_store.add_prevented(record)
        return {"ok": entry_id is not None}

    async def get_freeze_incidents(self):
        snapshot = self.freeze_incidents_store.snapshot()
        return {
            "ok": True,
            "totals": snapshot["totals"],
            "entries": snapshot["entries"],
            "standingDown": self.freeze_watchdog_service.standing_down(),
        }

    async def get_update_status(self):
        return self.update_checker_service.get_status()
