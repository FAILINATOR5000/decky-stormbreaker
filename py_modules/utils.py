import json
import os
import pwd
import signal
from pathlib import Path
from typing import Any

import decky


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        decky.logger.error(
            "%s is there but would not read (%s), falling back to defaults",
            path.name, type(e).__name__,
        )
        return default


_data_owner = None


def init_data_owner(*candidates) -> None:
    global _data_owner
    for path in candidates:
        try:
            st = path.stat()
        except OSError:
            continue
        if st.st_uid != 0:
            _data_owner = (st.st_uid, st.st_gid)
            return
    try:
        pw = pwd.getpwnam("deck")
        _data_owner = (pw.pw_uid, pw.pw_gid)
        return
    except (KeyError, OSError):
        pass
    _data_owner = None


_chown_warned = False


def chown_to_data_owner(path) -> None:
    global _chown_warned

    if _data_owner is None:
        return
    try:
        if os.geteuid() != 0:
            return
        os.chown(path, _data_owner[0], _data_owner[1])
    except OSError as exc:
        if not _chown_warned:
            _chown_warned = True
            decky.logger.warning(
                "chown back to the data owner failed (%s: %s) for %s; "
                "further failures this session stay quiet",
                type(exc).__name__,
                exc,
                path,
            )


def ensure_dir(path) -> None:
    made = []
    probe = path
    while not probe.exists() and probe.parent != probe:
        made.append(probe)
        probe = probe.parent
    path.mkdir(parents=True, exist_ok=True)
    chown_to_data_owner(path)
    for level in made[1:]:
        chown_to_data_owner(level)


def save_json_file(path: Path, payload: Any) -> None:
    serialized = json.dumps(payload, indent=2)
    ensure_dir(path.parent)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(serialized, encoding="utf-8")
    chown_to_data_owner(tmp)
    tmp.replace(path)


def kill_steamwebhelper() -> int:
    killed = 0
    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        try:
            comm = Path(f"/proc/{entry}/comm").read_text().strip()
        except OSError:
            continue
        if comm != "steamwebhelper":
            continue
        try:
            os.kill(int(entry), signal.SIGKILL)
        except OSError:
            continue
        killed += 1
    return killed
