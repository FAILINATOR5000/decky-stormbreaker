import { addEventListener, definePlugin, removeEventListener, toaster } from "@decky/api";
import { quickAccessMenuClasses } from "@decky/ui";
import { FaBolt } from "react-icons/fa";
import { getPluginVersion, getSettings, logStormbreakerEvent, UPDATE_FOUND_EVENT, type Settings } from "./api";
import { publishClaim, withdrawClaim } from "./claim";
import StormbreakerPanel from "./StormbreakerPanel";
import { logError } from "./errors";
import { setStormbreakerEnabled, setStormbreakerGameMode, uninstallStormbreaker } from "./stormbreaker";

const STARTUP_TRIES = 3;
const STARTUP_RETRY_MS = 1000;

function start(version: string, stormbreaker: boolean, automaticRecovery: boolean, gameMode: boolean): void {
    publishClaim(version, stormbreaker, automaticRecovery);
    try {
        setStormbreakerGameMode(gameMode);
        setStormbreakerEnabled(stormbreaker);
    }
    catch (e) {
        logError("starting Stormbreaker", e);
    }
}

async function readAtStartup(isDisposed: () => boolean): Promise<void> {
    let settings: (Settings & { gameMode?: boolean }) | null = null;
    let version = "";
    for (let attempt = 1; attempt <= STARTUP_TRIES; attempt += 1) {
        const [settingsRead, versionRead] = await Promise.allSettled([getSettings(), getPluginVersion()]);
        if (isDisposed()) {
            return;
        }
        if (versionRead.status === "fulfilled") {
            version = String(versionRead.value ?? "");
        }
        if (settingsRead.status === "fulfilled") {
            settings = settingsRead.value;
            break;
        }
        logError("loading settings at startup", settingsRead.reason);
        void logStormbreakerEvent("startup", `settings read failed, try ${attempt} of ${STARTUP_TRIES}: ${String(settingsRead.reason)}`)
            .catch(() => { });
        if (attempt < STARTUP_TRIES) {
            await new Promise((resolve) => window.setTimeout(resolve, STARTUP_RETRY_MS * attempt));
            if (isDisposed()) {
                return;
            }
        }
    }
    if (settings === null) {
        void logStormbreakerEvent("startup", "running on defaults").catch(() => { });
        start(version, true, true, true);
        return;
    }
    start(
        version,
        Boolean(settings?.stormbreaker ?? true),
        Boolean(settings?.automaticRecovery ?? true),
        settings?.gameMode ?? true
    );
}

function onUpdateFound(payload: { version?: unknown } | undefined): void {
    const version = typeof payload?.version === "string" ? payload.version : "";
    if (!version) {
        return;
    }
    toaster.toast({ title: "Stormbreaker Update", body: `Version ${version} is out` });
}

export default definePlugin(() => {
    let disposed = false;
    void readAtStartup(() => disposed).catch((e) => logError("starting at load", e));
    addEventListener(UPDATE_FOUND_EVENT, onUpdateFound);

    return {
        name: "Stormbreaker",
        title: <div className={quickAccessMenuClasses.Title}>Stormbreaker</div>,
        content: <StormbreakerPanel />,
        icon: <FaBolt />,
        onDismount() {
            disposed = true;
            removeEventListener(UPDATE_FOUND_EVENT, onUpdateFound);
            withdrawClaim();
            uninstallStormbreaker();
        }
    };
});
