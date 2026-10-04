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


def chown_to_data_owner(path, dir_fd=None) -> None:
    global _chown_warned

    if _data_owner is None:
        return
    try:
        if os.geteuid() != 0:
            return
        if isinstance(path, int):
            os.fchown(path, _data_owner[0], _data_owner[1])
        else:
            os.chown(path, _data_owner[0], _data_owner[1], dir_fd=dir_fd, follow_symlinks=False)
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


_write_roots = ()


def set_write_roots(*roots) -> None:
    global _write_roots
    _write_roots = tuple(Path(root) for root in roots)


def _root_for(path):
    best = None
    for root in _write_roots:
        if path.is_relative_to(root) and (best is None or len(root.parts) > len(best.parts)):
            best = root
    return best


_DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC


def _levels_below(path, trusted):
    try:
        below = path.relative_to(trusted).parts
    except ValueError:
        raise PermissionError(f"{path} is not under {trusted}") from None
    if ".." in below:
        raise PermissionError(f"{path} climbs out of {trusted}")
    return below


def open_dir(path, trusted=None) -> int:
    path = Path(path)
    if trusted is None:
        trusted = _root_for(path)
    if trusted is None:
        return os.open(path, _DIR_FLAGS | os.O_NOFOLLOW)
    below = _levels_below(path, trusted)
    fd = os.open("/", _DIR_FLAGS)
    try:
        for part in Path(os.path.realpath(trusted)).parts[1:] + below:
            inner = os.open(part, _DIR_FLAGS | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = inner
    except BaseException:
        os.close(fd)
        raise
    return fd


def ensure_dir(path, trusted=None) -> None:
    path = Path(path)
    if trusted is None:
        trusted = _root_for(path)
    if trusted is None or trusted == path:
        made = []
        probe = path
        while not probe.exists() and probe.parent != probe:
            made.append(probe)
            probe = probe.parent
        path.mkdir(parents=True, exist_ok=True)
        for level in made:
            chown_to_data_owner(level)
        return
    ensure_dir(trusted, trusted)
    fd = open_dir(trusted, trusted)
    try:
        for part in _levels_below(path, trusted):
            try:
                os.mkdir(part, 0o777, dir_fd=fd)
                created = True
            except FileExistsError:
                created = False
            inner = os.open(part, _DIR_FLAGS | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = inner
            if created:
                chown_to_data_owner(fd)
    finally:
        os.close(fd)


def _unlink_at(name, dir_fd) -> None:
    try:
        os.unlink(name, dir_fd=dir_fd)
    except FileNotFoundError:
        pass


def write_file_atomic(path, data, *, trusted=None) -> None:
    if isinstance(data, str):
        data = data.encode("utf-8")
    path = Path(path)
    dir_fd = open_dir(path.parent, trusted)
    tmp = path.name + ".tmp"
    try:
        _unlink_at(tmp, dir_fd)
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o666, dir_fd=dir_fd)
        try:
            chown_to_data_owner(fd)
            with os.fdopen(fd, "wb") as out:
                out.write(data)
            os.replace(tmp, path.name, src_dir_fd=dir_fd, dst_dir_fd=dir_fd)
        except BaseException:
            _unlink_at(tmp, dir_fd)
            raise
    finally:
        os.close(dir_fd)


def save_json_file(path: Path, payload: Any) -> None:
    serialized = json.dumps(payload, indent=2)
    ensure_dir(path.parent)
    write_file_atomic(path, serialized)


def kill_steamwebhelper() -> int:
    killed = 0
    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        try:
            comm = Path(f"/proc/{entry}/comm").read_text(errors="replace").strip()
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


WATCHDOG_LOCK = "/tmp/stormbreaker-watchdog.lock"
WATCHDOG_LOCK_RETRY = 1.0


def hold_watchdog_lock(stop_event):
    try:
        import fcntl
    except ImportError:
        decky.logger.warning("freeze watchdog: no fcntl, running without the watchdog lock")
        return None
    try:
        fd = os.open(WATCHDOG_LOCK, os.O_CREAT | os.O_RDWR, 0o644)
    except OSError as exc:
        decky.logger.warning(
            "freeze watchdog: could not open %s (%s: %s), running without the watchdog lock",
            WATCHDOG_LOCK,
            type(exc).__name__,
            exc,
        )
        return None
    while True:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except OSError:
            pass
        if stop_event.wait(WATCHDOG_LOCK_RETRY):
            os.close(fd)
            return None


def release_watchdog_lock(fd) -> None:
    if fd is None:
        return
    try:
        os.close(fd)
    except OSError:
        pass
