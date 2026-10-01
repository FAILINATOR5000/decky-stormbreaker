export function logError(label: string, err: unknown) {
    console.error(`[stormbreaker] ${label}:`, err);
}
