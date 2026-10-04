import { definePlugin } from "@decky/api";
import { quickAccessMenuClasses } from "@decky/ui";
import { FaBolt } from "react-icons/fa";
import { getPluginVersion, getSettings } from "./api";
import { publishClaim, withdrawClaim } from "./claim";
import StormbreakerPanel from "./StormbreakerPanel";
import { logError } from "./errors";
import { setStormbreakerEnabled, setStormbreakerGameMode, uninstallStormbreaker } from "./stormbreaker";

export default definePlugin(() => {
    let disposed = false;
    void Promise.all([getSettings(), getPluginVersion()])
        .then(([settings, version]) => {
            if (disposed) {
                return;
            }
            const stormbreaker = Boolean(settings?.stormbreaker ?? true);
            const automaticRecovery = Boolean(settings?.automaticRecovery ?? true);
            publishClaim(String(version ?? ""), stormbreaker, automaticRecovery);
            try {
                setStormbreakerGameMode(settings?.gameMode ?? true);
                setStormbreakerEnabled(stormbreaker);
            }
            catch (e) {
                logError("starting Stormbreaker", e);
            }
        })
        .catch((e) => logError("loading settings at startup", e));

    return {
        name: "Stormbreaker",
        title: <div className={quickAccessMenuClasses.Title}>Stormbreaker</div>,
        content: <StormbreakerPanel />,
        icon: <FaBolt />,
        onDismount() {
            disposed = true;
            withdrawClaim();
            uninstallStormbreaker();
        }
    };
});
