import { ButtonItem, Focusable, PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    clearRecoveryLogs,
    getSettings,
    getUpdateStatus,
    saveAutomaticRecovery,
    saveRecoveryLogs,
    saveStormbreaker,
    type FreezeIncident,
    type Settings
} from "./api";
import { updateClaim } from "./claim";
import { copyTextToClipboard } from "./clipboard";
import { logError } from "./errors";
import { IncidentCard } from "./IncidentCard";
import { ProtectionStatus, protectionLevel } from "./ProtectionStatus";
import { setStormbreakerEnabled } from "./stormbreaker";
import { achievementGreen, bodyTextStyle } from "./style";
import { SubTabButton } from "./SubTabButton";
import { toastAfterPress } from "./toast";
import { useStormbreakerLogController } from "./useStormbreakerLogController";
import { useWindowedList } from "./useWindowedList";

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

type Tab = "status" | "logs";

type UpdateNotice = {
    latestVersion: string;
    installUrl: string;
};

type CopyResult = "" | "copied" | "copyFailed";

const DIVIDER_STYLE = { height: "1px", background: "rgba(255, 255, 255, 0.2)", margin: "6px 0" };

const TABS: { value: Tab; label: string }[] = [
    { value: "status", label: "Status" },
    { value: "logs", label: "Logs" }
];

let openTab: Tab = "status";

function StormbreakerPanel() {
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [tab, setTab] = useState<Tab>(openTab);
    const log = useStormbreakerLogController();
    const [update, setUpdate] = useState<UpdateNotice | null>(null);
    const [copyResult, setCopyResult] = useState<CopyResult>("");
    const updateBlockRef = useRef<HTMLDivElement>(null);

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
        getUpdateStatus()
            .then((status) => {
                if (status?.updateAvailable === true && typeof status.latestVersion === "string"
                    && typeof status.installUrl === "string" && status.installUrl) {
                    setUpdate({ latestVersion: status.latestVersion, installUrl: status.installUrl });
                }
            })
            .catch((e) => logError("loading the update status", e));
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
            toastAfterPress({ title: "Recovery Logs", body: "Recovery logs cleared." });
        }
        catch (e) {
            logError("clearing recovery logs", e);
        }
        finally {
            setClearing(false);
        }
    }

    function onCopyInstallLink() {
        if (!update) {
            return;
        }
        setCopyResult(copyTextToClipboard(update.installUrl, updateBlockRef.current) ? "copied" : "copyFailed");
    }

    function changeTab(next: Tab) {
        openTab = next;
        setTab(next);
    }

    const statusBody = (
        <>
            <ProtectionStatus
                level={protectionLevel({
                    stormbreaker: settings.stormbreaker,
                    automaticRecovery: settings.automaticRecovery,
                    standingDown: log.standingDown
                })}
                totals={log.totals}
                standingDown={log.standingDown}
                settingsLoaded={!loading}
                loaded={log.loaded}
            />
            {update && (
                <>
                    <PanelSectionRow>
                        <div style={DIVIDER_STYLE} />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <div ref={updateBlockRef} style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "4px 0" }}>
                            <div style={{ textAlign: "center", color: achievementGreen, fontSize: "15px", fontWeight: 700 }}>
                                {`Update Available: ${update.latestVersion}`}
                            </div>
                            <div style={bodyTextStyle}>
                                Update by clicking the Stormbreaker updater on desktop, or using the link below.
                            </div>
                        </div>
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <ButtonItem
                            layout="below"
                            bottomSeparator="none"
                            description="Paste this link into Decky → Settings → Developer → Install from URL."
                            onClick={onCopyInstallLink}
                        >
                            Copy Install Link
                        </ButtonItem>
                    </PanelSectionRow>
                    {copyResult && (
                        <PanelSectionRow>
                            <div style={{ ...bodyTextStyle, padding: "4px 0" }}>
                                {copyResult === "copied"
                                    ? "Install link copied."
                                    : "Couldn't copy the link. Try the desktop updater instead."}
                            </div>
                        </PanelSectionRow>
                    )}
                    <PanelSectionRow>
                        <div style={DIVIDER_STYLE} />
                    </PanelSectionRow>
                </>
            )}
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
                    description="Enabling this will turn on the watchdog service which will detect the freeze caused by the Steam focus glitch and free you from being stuck—usually 10–15 seconds after the freeze. The Steam interface will be reset without shutting off your game, but it will move you back to the game launch screen where all you have to do is resume it and you are exactly where you left off."
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
        </>
    );

    return (
        <PanelSection>
            <Focusable
                flow-children="row"
                style={{ width: "100%", display: "flex", gap: "6px", margin: "6px 0 4px 0" }}
            >
                {TABS.map((entry) => (
                    <SubTabButton
                        key={entry.value}
                        label={entry.label}
                        active={tab === entry.value}
                        onClick={() => changeTab(entry.value)}
                    />
                ))}
            </Focusable>

            <Focusable key={`tab:${tab}`}>
                {tab === "status" ? statusBody : <IncidentLog entries={log.entries} loaded={log.loaded} />}
            </Focusable>
        </PanelSection>
    );
}

function IncidentLog(props: { entries: FreezeIncident[]; loaded: boolean }) {
    const { entries } = props;
    const { mountedItems, markerRef, onItemFocus } = useWindowedList({
        items: entries,
        dynamicLoading: true,
        initialRows: 30,
        rowStep: 5,
        prefetchDistance: 12,
        sentinelRootMargin: "600px 0px",
        resetKey: "log"
    });
    const itemFocusRef = useRef(onItemFocus);
    itemFocusRef.current = onItemFocus;
    const onCardFocus = useCallback((index: number) => itemFocusRef.current(index), []);

    return (
        <>
            {props.loaded && entries.length === 0 && (
                <PanelSectionRow>
                    <div style={{ ...bodyTextStyle, padding: "8px 0" }}>No incidents yet.</div>
                </PanelSectionRow>
            )}
            {mountedItems.map((incident, index) => (
                <PanelSectionRow key={incident.id}>
                    <IncidentCard incident={incident} index={index} onCardFocus={onCardFocus} />
                </PanelSectionRow>
            ))}
            {mountedItems.length < entries.length && (
                <div ref={markerRef} style={{ height: "1px" }} />
            )}
        </>
    );
}

export default StormbreakerPanel;
