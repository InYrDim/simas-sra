import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import type { TenantNavItem } from "@/types/components/TenantNavItem";

/**
 * Per-Tenant sidebar menu visibility.
 *
 * Provider can hide individual sidebar buttons (top-level items and their
 * sub-items) for a Tenant. Visibility is stored under `tenant.settings.menu`
 * as a map of menu item `key` -> boolean (`true` = visible, the default).
 *
 * This is independent of the Provider feature gate (`tenant-features.ts`):
 * feature gating grays/locks an item but keeps it visible, whereas menu
 * visibility fully removes the button from the sidebar and blocks direct
 * URL access to its route on the server.
 */

export type TenantMenuVisibility = Record<string, boolean>;

/** Every menu key defined in the static tenant navigation config. */
export const TENANT_MENU_KEYS: readonly string[] = (() => {
    const keys: string[] = [];
    for (const item of tenantMenuItems) {
        keys.push(item.key);
        for (const child of item.items ?? []) keys.push(child.key);
    }
    return keys;
})();

const menuKeySet = new Set(TENANT_MENU_KEYS);

export function isKnownMenuKey(key: string): boolean {
    return menuKeySet.has(key);
}

/**
 * Read the effective visibility map from tenant settings.
 *
 * Keys absent from settings default to `true` (visible) so existing tenants
 * keep every menu until a Provider explicitly hides one. Unknown keys in
 * settings are ignored.
 */
export function readTenantMenuVisibility(settings: unknown): TenantMenuVisibility {
    const root = settings && typeof settings === "object"
        ? settings as Record<string, unknown>
        : {};
    const menu = root.menu && typeof root.menu === "object"
        ? root.menu as Record<string, unknown>
        : {};

    const visibility: TenantMenuVisibility = {};
    for (const key of TENANT_MENU_KEYS) {
        visibility[key] = menu[key] !== false;
    }
    return visibility;
}

/** Merge a partial visibility selection into existing tenant settings. */
export function mergeTenantMenuVisibility(
    settings: unknown,
    visibility: TenantMenuVisibility,
): Record<string, unknown> {
    const root = settings && typeof settings === "object"
        ? { ...settings as Record<string, unknown> }
        : {};
    const existingMenu = root.menu && typeof root.menu === "object"
        ? root.menu as Record<string, unknown>
        : {};

    const nextMenu: Record<string, unknown> = { ...existingMenu };
    for (const [key, visible] of Object.entries(visibility)) {
        if (isKnownMenuKey(key)) nextMenu[key] = visible !== false;
    }

    return { ...root, menu: nextMenu };
}

/**
 * Resolve the set of hidden menu keys (parent keys whose value is `false`).
 * A parent key being hidden also hides all of its sub-items, even when a
 * sub-item key is explicitly `true`.
 */
export function resolveHiddenMenuKeys(visibility: TenantMenuVisibility): Set<string> {
    const hidden = new Set<string>();
    for (const item of tenantMenuItems) {
        if (visibility[item.key] === false) {
            hidden.add(item.key);
            for (const child of item.items ?? []) hidden.add(child.key);
        } else {
            for (const child of item.items ?? []) {
                if (visibility[child.key] === false) hidden.add(child.key);
            }
        }
    }
    return hidden;
}

/**
 * Whether a menu item (or any of its sub-items) is hidden. Used by the
 * sidebar to drop items and by the server guard to block direct URL access.
 */
export function isMenuKeyHidden(visibility: TenantMenuVisibility, key: string): boolean {
    return resolveHiddenMenuKeys(visibility).has(key);
}

/** Collect every menu key reachable from a navigation item (item + sub-items). */
export function collectMenuKeys(item: TenantNavItem): string[] {
    const keys = [item.key];
    for (const child of item.items ?? []) keys.push(child.key);
    return keys;
}

/**
 * Resolve the menu key that owns a tenant-relative path (e.g. `/ppdb/settings`).
 *
 * Exact URL matches win; otherwise the longest URL prefix match applies, so
 * hiding a parent item (e.g. `/master`) also blocks every child route beneath
 * it. Returns `null` when no menu item owns the path.
 */
export function resolveMenuKeyForPath(relativePath: string): string | null {
    const normalized = relativePath === "/" ? "/" : relativePath.replace(/\/+$/, "");
    let exactKey: string | null = null;
    let bestPrefixKey: string | null = null;
    let bestPrefixLength = -1;

    const consider = (item: TenantNavItem) => {
        if (!item.url) return;
        const url = item.url === "/" ? "/" : item.url.replace(/\/+$/, "");
        if (url === normalized) {
            exactKey = item.key;
        } else if (normalized === url || normalized.startsWith(`${url}/`)) {
            if (url.length > bestPrefixLength) {
                bestPrefixLength = url.length;
                bestPrefixKey = item.key;
            }
        }
    };

    for (const item of tenantMenuItems) {
        consider(item);
        for (const child of item.items ?? []) consider(child);
    }

    return exactKey ?? bestPrefixKey;
}
