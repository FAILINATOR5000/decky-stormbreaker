import json
import threading
import time
import urllib.request

import decky


GITHUB_OWNER = "FAILINATOR5000"
GITHUB_REPO = "decky-stormbreaker"

LATEST_RELEASE_URL = "https://api.github.com/repos/%s/%s/releases/latest" % (GITHUB_OWNER, GITHUB_REPO)

CHECK_INTERVAL_SECONDS = 12 * 60 * 60

TICK_SECONDS = 15 * 60

STARTUP_DELAY_SECONDS = 20.0

FETCH_TIMEOUT_SECONDS = 15


class GenerationFence:
    def __init__(self):
        self._lock = threading.Lock()
        self._current = 0

    def claim(self):
        with self._lock:
            self._current += 1
            return self._current

    def is_live(self, mine):
        with self._lock:
            return mine == self._current


_generation_fence = GenerationFence()


def display_version(raw):
    text = str(raw or "").strip()
    if text[:1] in ("v", "V"):
        text = text[1:]
    return text


def parse_version(raw):
    text = display_version(raw)
    if not text:
        return None

    parts = []
    for chunk in text.split("."):
        if not chunk.isdigit():
            return None
        parts.append(int(chunk))
    return tuple(parts) if parts else None


def release_asset_name(tag):
    number = display_version(tag)
    if parse_version(number) is None:
        return ""
    return "Stormbreaker-%s.zip" % number


def release_install_url(tag):
    name = release_asset_name(tag)
    if not name:
        return ""
    return "https://github.com/%s/%s/releases/download/%s/%s" % (
        GITHUB_OWNER,
        GITHUB_REPO,
        str(tag or "").strip(),
        name,
    )


def is_newer_version(candidate, installed):
    left = parse_version(candidate)
    right = parse_version(installed)
    if left is None or right is None:
        return False
    return left > right


def installed_version():
    return str(getattr(decky, "DECKY_PLUGIN_VERSION", "") or "").strip()


class UpdateCheckerService:
    def __init__(self, *, settings_store, ssl_context, on_found, game_mode):
        self._settings_store = settings_store
        self._ssl_context = ssl_context
        self._on_found = on_found
        self._game_mode = game_mode
        self._frontend_seen = False
        self._held = False
        self._thread = None
        self._stop_event = threading.Event()
        self._lifecycle_lock = threading.Lock()
        self._check_lock = threading.Lock()
        self._generation = -1
        self._failing = False
        self._warned_tag = ""

    def start(self):
        with self._lifecycle_lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._generation = _generation_fence.claim()
            thread = threading.Thread(target=self._run_loop, args=(self._generation,), name="update-checker", daemon=True)
            self._thread = thread
        thread.start()
        decky.logger.info("update: thread started (generation %d)", self._generation)

    def stop(self):
        self._stop_event.set()
        decky.logger.info("update: stop requested")

    def _run_loop(self, my_generation):
        if self._stop_event.wait(STARTUP_DELAY_SECONDS):
            return

        while not self._stop_event.is_set():
            if not _generation_fence.is_live(my_generation):
                return
            try:
                self.check()
            except Exception as exc:
                decky.logger.exception("update: tick crashed: %s (%s)", type(exc).__name__, exc)
            if self._stop_event.wait(TICK_SECONDS):
                return

    def check(self):
        with self._check_lock:
            state = self._settings_store.load_update_check_state()
            now = int(time.time())
            last_checked = state["lastCheckedAt"]

            if last_checked > now:
                last_checked = 0

            if last_checked and now - last_checked < CHECK_INTERVAL_SECONDS:
                self._maybe_notify(state)
                return

            try:
                release = self._fetch_latest_release()
            except Exception as exc:
                if not self._failing:
                    self._failing = True
                    decky.logger.info("update: couldn't reach GitHub (%s: %s), trying again later", type(exc).__name__, exc)
                return
            if self._failing:
                self._failing = False
                decky.logger.info("update: GitHub reachable again")

            if release is None:
                return

            self._settings_store.save_update_release(release, now)
            state = {
                "release": release,
                "lastCheckedAt": now,
                "lastNotifiedTag": state["lastNotifiedTag"],
            }
            self._maybe_notify(state)

    def frontend_arrived(self):
        self._frontend_seen = True
        if self._held:
            threading.Thread(target=self._announce_held, name="update-announce", daemon=True).start()

    def _announce_held(self):
        try:
            with self._check_lock:
                self._maybe_notify(self._settings_store.load_update_check_state())
        except Exception as exc:
            decky.logger.warning("update: announcing a held release failed (%s: %s)", type(exc).__name__, exc)

    def get_status(self):
        state = self._settings_store.load_update_check_state()
        release = state["release"]
        tag = release.get("tag", "") if release else ""
        current = installed_version()
        return {
            "ok": True,
            "installedVersion": current,
            "latestVersion": display_version(tag),
            "updateAvailable": is_newer_version(tag, current),
            "installUrl": release_install_url(tag),
        }

    def _fetch_latest_release(self):
        request = urllib.request.Request(
            LATEST_RELEASE_URL,
            headers={
                "User-Agent": "stormbreaker/%s" % installed_version(),
                "Accept": "application/vnd.github+json",
            },
        )
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECONDS, context=self._ssl_context) as response:
            raw = json.loads(response.read().decode("utf-8"))

        if not isinstance(raw, dict):
            return None

        tag = str(raw.get("tag_name") or "").strip()
        if not tag:
            return None

        wanted = release_asset_name(tag)
        if not wanted or not self._has_install_asset(raw, wanted):
            if tag != self._warned_tag:
                self._warned_tag = tag
                decky.logger.warning("update: release %s has no %s asset, ignoring", tag, wanted or "version-stamped zip")
            return None

        return {
            "tag": tag,
            "htmlUrl": str(raw.get("html_url") or "").strip(),
            "publishedAt": str(raw.get("published_at") or "").strip(),
        }

    def _has_install_asset(self, raw, wanted):
        assets = raw.get("assets")
        if not isinstance(assets, list):
            return False
        for asset in assets:
            if isinstance(asset, dict) and str(asset.get("name") or "").strip() == wanted:
                return True
        return False

    def _maybe_notify(self, state):
        release = state["release"]
        if not isinstance(release, dict):
            return
        tag = release.get("tag", "")
        if not is_newer_version(tag, installed_version()):
            return
        if tag == state["lastNotifiedTag"]:
            return

        if not self._frontend_seen or not self._game_mode():
            self._held = True
            return
        self._held = False

        self._settings_store.save_update_notified_tag(tag)
        decky.logger.info("update: %s is newer than %s, announcing it", tag, installed_version())
        try:
            self._on_found(display_version(tag))
        except Exception as exc:
            decky.logger.warning("update: announcing %s failed (%s: %s)", tag, type(exc).__name__, exc)
