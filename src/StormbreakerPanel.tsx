import { ButtonItem, PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";
import {
    clearRecoveryLogs,
    getSettings,
    saveAutomaticRecovery,
    saveRecoveryLogs,
    saveStormbreaker,
    type Settings
} from "./api";
import { updateClaim } from "./claim";
import { logError } from "./errors";
import { setStormbreakerEnabled } from "./stormbreaker";

const DEFAULT_SETTINGS: Settings = {
    stormbreaker: true,
    automaticRecovery: true,
    recoveryLogs: false
};

const SAVE_CALLS: Record<keyof Settings, (value: boolean) => Promise<Partial<Settings>>> = {
    stormbreaker: saveStormbreaker,
    automaticRecovery: saveAutomaticRecovery,
    recoveryLogs: saveRecoveryLogs
};

function StormbreakerPanel() {
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

    useEffect(() => {
        getSettings()
            .then((saved) => {
                setSettings({
                    stormbreaker: Boolean(saved?.stormbreaker ?? DEFAULT_SETTINGS.stormbreaker),
                    automaticRecovery: Boolean(saved?.automaticRecovery ?? DEFAULT_SETTINGS.automaticRecovery),
                    recoveryLogs: Boolean(saved?.recoveryLogs ?? DEFAULT_SETTINGS.recoveryLogs)
                });
            })
            .catch((e) => logError("loading settings", e))
            .finally(() => setLoading(false));
    }, []);

    function applySetting(key: keyof Settings, value: boolean) {
        setSettings((current) => ({ ...current, [key]: value }));
        if (key === "stormbreaker") {
            setStormbreakerEnabled(value);
        }
        if (key === "stormbreaker" || key === "automaticRecovery") {
            updateClaim(key, value);
        }
    }

    async function onToggle(key: keyof Settings, nextValue: boolean) {
        const previousValue = settings[key];
        applySetting(key, nextValue);
        try {
            const result = await SAVE_CALLS[key](nextValue);
            applySetting(key, Boolean(result?.[key] ?? nextValue));
        }
        catch (e) {
            logError(`saving ${key}`, e);
            applySetting(key, previousValue);
        }
    }

    async function onClearRecoveryLogs() {
        setClearing(true);
        try {
            await clearRecoveryLogs();
        }
        catch (e) {
            logError("clearing recovery logs", e);
        }
        finally {
            setClearing(false);
        }
    }

    return (
        <PanelSection>
            <PanelSectionRow>
                <ToggleField
                    label="Stormbreaker"
                    description="Stops a rare SteamOS freeze that can start as the Quick Access Menu opens. When one begins, the menu blinks once and carries on instead of Steam's interface freezing. It only acts during that moment and changes no Steam code."
                    checked={settings.stormbreaker}
                    disabled={loading}
                    onChange={(value) => void onToggle("stormbreaker", value)}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    label="Automatic Recovery"
                    description="SteamOS has a known bug where the Quick Access Menu can freeze on screen or get stuck after being opened and closed quickly. Enabling this will turn on the watchdog service which will detect this situation and free you from being stuck—usually in about 10 seconds from the freeze. The Steam interface will be reset without shutting off your game, but it will move you back to the game launch screen where all you have to do is resume it and you are exactly where you left off."
                    checked={settings.automaticRecovery}
                    disabled={loading}
                    onChange={(value) => void onToggle("automaticRecovery", value)}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ToggleField
                    label="Save Recovery Logs"
                    description="Saves a record of each recovery to the plugin's log folder, including what Steam's interface was doing when it froze, and writes detailed recovery activity to the plugin log. Useful when reporting a problem. Steam does a little more work while this is on, so leave it off otherwise."
                    checked={settings.recoveryLogs}
                    disabled={loading}
                    onChange={(value) => void onToggle("recoveryLogs", value)}
                />
            </PanelSectionRow>
            <PanelSectionRow>
                <ButtonItem
                    layout="below"
                    description="Deletes every saved recovery record from the plugin's log folder."
                    disabled={loading || clearing}
                    onClick={() => void onClearRecoveryLogs()}
                >
                    Clear Recovery Logs
                </ButtonItem>
            </PanelSectionRow>
        </PanelSection>
    );
}

export default StormbreakerPanel;
