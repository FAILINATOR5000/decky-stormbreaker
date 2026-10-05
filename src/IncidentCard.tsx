import { ButtonItem } from "@decky/ui";
import React from "react";
// Font Awesome Free icons, CC BY 4.0. See THIRD-PARTY-LICENSES.
import { FaHandPaper, FaRedoAlt, FaShieldAlt } from "react-icons/fa";

import type { FreezeIncident } from "./api";
import { achievementGreen, bodyTextStyle, masteredGold } from "./style";

export type IncidentCardProps = {
    incident: FreezeIncident;
    index: number;
    onCardFocus: (index: number) => void;
};

const CONTROLLER_LINES: Record<string, string> = {
    deck: "Button combo held on the Steam Deck",
    controller: "Button combo held on a Steam Controller",
    ally: "Button combo held on the ROG Ally"
};

function confirmationLabel(name: string, rssGrowthMb: number): string {
    if (name === "fresh") {
        return "no response on a new connection";
    }
    if (name === "cpu") {
        return "high CPU use";
    }
    if (name === "memory") {
        return `memory growth of ${rssGrowthMb} MB`;
    }
    return "repeated focus errors";
}

function captureLine(capture: string | null): string {
    return capture ? `Recovery log: ${capture}` : "Recovery log: none";
}

function cardDate(at: number): string {
    const date = new Date(at * 1000);
    const day = date.toLocaleDateString(undefined, { year: "2-digit", month: "numeric", day: "numeric" });
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${day} ${time}`;
}

function statLines(incident: FreezeIncident): string[] {
    if (incident.kind === "prevented") {
        const changes = incident.changes === 1 ? "focus change" : "focus changes";
        const lines = [`Detected: ${incident.changes} ${changes} in ${incident.spanMs} ms`];
        if (incident.afterHiding > 0) {
            lines.push(`Focus changes while hidden: ${incident.afterHiding}`);
        }
        lines.push(incident.endedBy === "quiet"
            ? `Menu hidden for ${incident.hiddenMs} ms, until the storm stopped`
            : `Menu hidden for ${Math.max(1, Math.round(incident.hiddenMs / 1000))} s; storm still active when restored`);
        if (incident.game) {
            lines.push(`Game: ${incident.game}`);
        }
        return lines;
    }
    if (incident.kind === "recovered") {
        const lines = [`No response to pings for ${incident.silenceS} s`];
        if (incident.confirmations.length > 0) {
            const signals = incident.confirmations.map((name) => confirmationLabel(name, incident.rssGrowthMb));
            lines.push(`Also confirmed by: ${signals.join(", ")}`);
        }
        lines.push(`Steam processes restarted: ${incident.killed}`);
        if (incident.backAfterS !== null) {
            lines.push(`Responding again ${incident.backAfterS} s after the restart`);
        }
        lines.push(captureLine(incident.capture));
        if (incident.pausedAfter) {
            lines.push("Automatic Recovery paused until the plugin reloads");
        }
        return lines;
    }
    const lines: string[] = [];
    if (Object.prototype.hasOwnProperty.call(CONTROLLER_LINES, incident.controller)) {
        lines.push(CONTROLLER_LINES[incident.controller]);
    }
    lines.push(`Steam processes restarted: ${incident.killed}`);
    lines.push(captureLine(incident.capture));
    return lines;
}

function heading(incident: FreezeIncident) {
    if (incident.kind === "prevented") {
        return { icon: <FaShieldAlt />, title: "Freeze Prevented", color: achievementGreen };
    }
    if (incident.kind === "recovered") {
        return { icon: <FaRedoAlt />, title: "Freeze Recovered", color: masteredGold };
    }
    return { icon: <FaHandPaper />, title: "Manual Recovery", color: undefined };
}

export const IncidentCard = React.memo(function IncidentCard(props: IncidentCardProps) {
    const { incident } = props;
    const { icon, title, color } = heading(incident);
    const focusEvents = { onGamepadFocus: () => props.onCardFocus(props.index) };

    return (
        <ButtonItem layout="below" {...focusEvents}>
            <div
                style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    textAlign: "left",
                    padding: "3px 0",
                    minWidth: 0
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "15px", color }}>
                    {icon}
                    <span>{title}</span>
                </div>
                <div style={{ ...bodyTextStyle, fontWeight: 700, opacity: 1 }}>
                    {cardDate(incident.at)}
                </div>
                {statLines(incident).map((line) => (
                    <div key={line} style={{ ...bodyTextStyle, display: "flex", gap: "6px", minWidth: 0 }}>
                        <span>•</span>
                        <span style={{ minWidth: 0, wordBreak: "break-word" }}>{line}</span>
                    </div>
                ))}
            </div>
        </ButtonItem>
    );
});
