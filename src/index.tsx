import { definePlugin } from "@decky/api";
import { PanelSection, quickAccessMenuClasses } from "@decky/ui";
import { FaBolt } from "react-icons/fa";

export default definePlugin(() => {
    return {
        name: "Stormbreaker",
        title: <div className={quickAccessMenuClasses.Title}>Stormbreaker</div>,
        content: <PanelSection />,
        icon: <FaBolt />
    };
});
