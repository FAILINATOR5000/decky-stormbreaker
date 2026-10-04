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
