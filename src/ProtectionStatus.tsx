// Font Awesome Free icons, CC BY 4.0. See THIRD-PARTY-LICENSES.
import { FaShieldAlt } from "react-icons/fa";

import type { FreezeIncidentTotals } from "./api";
import { achievementGreen, bodyTextStyle, errorRed, masteredGold } from "./style";

export type ProtectionLevel = "protected" | "partial" | "unprotected";

export function protectionLevel(input: {
    stormbreaker: boolean;
    automaticRecovery: boolean;
    standingDown: boolean;
}): ProtectionLevel {
    const breaker = input.stormbreaker;
    const recovery = input.automaticRecovery && !input.standingDown;
    if (breaker && recovery) {
        return "protected";
    }
    return breaker || recovery ? "partial" : "unprotected";
}

const LEVELS: Record<ProtectionLevel, { label: string; color: string }> = {
    protected: { label: "Protected", color: achievementGreen },
    partial: { label: "Partially Protected", color: masteredGold },
    unprotected: { label: "Unprotected", color: errorRed }
};

export function ProtectionStatus(props: {
    level: ProtectionLevel;
    totals: FreezeIncidentTotals;
    standingDown: boolean;
    settingsLoaded: boolean;
    loaded: boolean;
}) {
    const { level, totals } = props;
    const { label, color } = LEVELS[level];
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 0 6px 0" }}>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    visibility: props.settingsLoaded ? "visible" : "hidden"
                }}
            >
                <div style={{ fontSize: "22px", fontWeight: 800, color, textAlign: "center" }}>
                    {label}
                </div>
                <FaShieldAlt size={64} color={color} />
            </div>
            <div style={{ ...bodyTextStyle, fontSize: "13px", visibility: props.loaded ? "visible" : "hidden" }}>
                <div>{`QAM Freezes Prevented: ${totals.prevented}`}</div>
                <div>{`Steam UI Freezes Recovered: ${totals.recovered}`}</div>
                {props.standingDown && (
                    <div>Automatic Recovery paused until the plugin reloads</div>
                )}
            </div>
        </div>
    );
}
