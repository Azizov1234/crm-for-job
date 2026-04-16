const ACCESS_TOKEN_KEY = "academy_access_token";
const BRANCH_ID_KEY = "academy_active_branch_id";
export const BRANCH_CHANGED_EVENT = "academy:branch-changed";
export const BRANCHES_UPDATED_EVENT = "academy:branches-updated";

function safeStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getAccessToken() {
  return safeStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function setAccessToken(accessToken: string) {
  const storage = safeStorage();
  if (!storage) return;

  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function clearAccessToken() {
  const storage = safeStorage();
  if (!storage) return;

  storage.removeItem(ACCESS_TOKEN_KEY);
}

export function getActiveBranchId() {
  return safeStorage()?.getItem(BRANCH_ID_KEY) ?? null;
}

export function setActiveBranchId(branchId: string) {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(BRANCH_ID_KEY, branchId);
  window.dispatchEvent(
    new CustomEvent(BRANCH_CHANGED_EVENT, { detail: { branchId } }),
  );
}

export function clearActiveBranchId() {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem(BRANCH_ID_KEY);
  window.dispatchEvent(
    new CustomEvent(BRANCH_CHANGED_EVENT, { detail: { branchId: null } }),
  );
}

export function notifyBranchesUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(BRANCHES_UPDATED_EVENT));
}
