import { definePlugin } from "@decky/api";
import { quickAccessMenuClasses } from "@decky/ui";
import { FaBolt } from "react-icons/fa";
import { getSettings } from "./api";
import StormbreakerPanel from "./StormbreakerPanel";
import { logError } from "./errors";
import { setStormbreakerEnabled, uninstallStormbreaker } from "./stormbreaker";

export default definePlugin(() => {
    void getSettings()
        .then((settings) => {
            setStormbreakerEnabled(Boolean(settings?.stormbreaker ?? true));
        })
        .catch((e) => logError("loading settings at startup", e));

    return {
        name: "Stormbreaker",
        title: <div className={quickAccessMenuClasses.Title}>Stormbreaker</div>,
        content: <StormbreakerPanel />,
        icon: <FaBolt />,
        onDismount() {
            uninstallStormbreaker();
        }
    };
});
