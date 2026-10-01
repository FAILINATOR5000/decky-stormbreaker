import { definePlugin } from "@decky/api";
import { quickAccessMenuClasses } from "@decky/ui";
import { FaBolt } from "react-icons/fa";
import { getPluginVersion, getSettings } from "./api";
import { publishClaim, withdrawClaim } from "./claim";
import StormbreakerPanel from "./StormbreakerPanel";
import { logError } from "./errors";
import { setStormbreakerEnabled, uninstallStormbreaker } from "./stormbreaker";

export default definePlugin(() => {
    void Promise.all([getSettings(), getPluginVersion()])
        .then(([settings, version]) => {
            const stormbreaker = Boolean(settings?.stormbreaker ?? true);
            const automaticRecovery = Boolean(settings?.automaticRecovery ?? true);
            setStormbreakerEnabled(stormbreaker);
            publishClaim(String(version ?? ""), stormbreaker, automaticRecovery);
        })
        .catch((e) => logError("loading settings at startup", e));

    return {
        name: "Stormbreaker",
        title: <div className={quickAccessMenuClasses.Title}>Stormbreaker</div>,
        content: <StormbreakerPanel />,
        icon: <FaBolt />,
        onDismount() {
            withdrawClaim();
            uninstallStormbreaker();
        }
    };
});
