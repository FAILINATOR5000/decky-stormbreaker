import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";
import { getSettings, saveStormbreaker } from "./api";
import { logError } from "./errors";
import { setStormbreakerEnabled } from "./stormbreaker";

function StormbreakerPanel() {
    const [loading, setLoading] = useState(true);
    const [stormbreaker, setStormbreaker] = useState(true);

    useEffect(() => {
        getSettings()
            .then((settings) => {
                setStormbreaker(Boolean(settings?.stormbreaker ?? true));
            })
            .catch((e) => logError("loading settings", e))
            .finally(() => setLoading(false));
    }, []);

    async function onToggleStormbreaker(nextValue: boolean) {
        const previousValue = stormbreaker;
        setStormbreaker(nextValue);
        setStormbreakerEnabled(nextValue);
        try {
            const result = await saveStormbreaker(nextValue);
            const saved = Boolean(result?.stormbreaker ?? nextValue);
            setStormbreaker(saved);
            setStormbreakerEnabled(saved);
        }
        catch (e) {
            logError("saving Stormbreaker", e);
            setStormbreaker(previousValue);
            setStormbreakerEnabled(previousValue);
        }
    }

    return (
        <PanelSection>
            <PanelSectionRow>
                <ToggleField
                    label="Stormbreaker"
                    description="Stops a rare SteamOS freeze that can start as the Quick Access Menu opens. When one begins, the menu blinks once and carries on instead of Steam's interface freezing. It only acts during that moment and changes no Steam code."
                    checked={stormbreaker}
                    disabled={loading}
                    onChange={(value) => void onToggleStormbreaker(value)}
                />
            </PanelSectionRow>
        </PanelSection>
    );
}

export default StormbreakerPanel;
