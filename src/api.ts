import { callable } from "@decky/api";

export type Settings = {
    stormbreaker: boolean;
    automaticRecovery: boolean;
    recoveryLogs: boolean;
};

export const getSettings = callable<[], Settings & { gameMode?: boolean }>("get_settings");
export const getPluginVersion = callable<[], string>("get_plugin_version");
export const saveStormbreaker = callable<[boolean], { ok: boolean; stormbreaker: boolean }>(
    "save_stormbreaker"
);
export const saveAutomaticRecovery = callable<[boolean], { ok: boolean; automaticRecovery: boolean }>(
    "save_automatic_recovery"
);
export const saveRecoveryLogs = callable<[boolean], { ok: boolean; recoveryLogs: boolean }>(
    "save_recovery_logs"
);
export const clearRecoveryLogs = callable<[], { ok: boolean; removed: number }>(
    "clear_recovery_logs"
);
export const logStormbreakerEvent = callable<[string, string], { ok: boolean }>(
    "log_stormbreaker_event"
);

export type FreezeIncident =
    | {
        id: string;
        kind: "prevented";
        at: number;
        changes: number;
        spanMs: number;
        afterHiding: number;
        lastChangeMs: number;
        endedBy: "quiet" | "cap";
        viewShown: boolean;
        hiddenMs: number;
        game: string;
    }
    | {
        id: string;
        kind: "recovered";
        at: number;
        silenceS: number;
        score: number;
        confirmations: Array<"fresh" | "cpu" | "memory" | "focus">;
        busiestCores: number;
        rssGrowthMb: number;
        killed: number;
        verdict: string | null;
        capture: string | null;
        pausedAfter: boolean;
        backAfterS: number | null;
    }
    | {
        id: string;
        kind: "manual";
        at: number;
        controller: string;
        killed: number;
        capture: string | null;
    };

export type StormBrokenRecord = {
    changes: number;
    spanMs: number;
    afterHiding: number;
    lastChangeMs: number;
    endedBy: "quiet" | "cap";
    viewShown: boolean;
    hiddenMs: number;
    game: string;
};

export type FreezeIncidentTotals = {
    prevented: number;
    recovered: number;
    manual: number;
};

export const FREEZE_INCIDENT_EVENT = "stormbreaker_freeze_incident";
export const recordStormBroken = callable<[record: StormBrokenRecord], { ok: boolean }>(
    "record_storm_broken"
);
export const getFreezeIncidents = callable<
    [],
    { ok: boolean; totals: FreezeIncidentTotals; entries: FreezeIncident[]; standingDown: boolean }
>("get_freeze_incidents");

export const UPDATE_FOUND_EVENT = "stormbreaker_update_found";
export const getUpdateStatus = callable<
    [],
    { ok: boolean; installedVersion: string; latestVersion: string; updateAvailable: boolean; installUrl: string }
>("get_update_status");
