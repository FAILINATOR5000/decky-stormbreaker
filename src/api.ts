import { callable } from "@decky/api";

export type Settings = {
    stormbreaker: boolean;
};

export const getSettings = callable<[], Settings>("get_settings");
export const saveStormbreaker = callable<[boolean], { ok: boolean; stormbreaker: boolean }>(
    "save_stormbreaker"
);
export const logStormbreakerEvent = callable<[string, string], { ok: boolean }>(
    "log_stormbreaker_event"
);
