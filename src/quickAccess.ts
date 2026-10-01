import { getGamepadNavigationTrees } from "@decky/ui";

export function quickAccessWindow(): Window | null {
    const tree = getGamepadNavigationTrees().find((t: any) => t?.id === "QuickAccess-NA");
    return tree?.m_Root?.m_element?.ownerDocument?.defaultView ?? null;
}
