import { toaster } from "@decky/api";

const PRESS_TOAST_DELAY_MS = 500;

export function toastAfterPress(toast: Parameters<typeof toaster.toast>[0]): void {
    window.setTimeout(() => {
        toaster.toast(toast);
    }, PRESS_TOAST_DELAY_MS);
}
