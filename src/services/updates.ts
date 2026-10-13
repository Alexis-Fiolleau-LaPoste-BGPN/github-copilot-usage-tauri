export interface AvailableUpdate {
  version: string;
  releaseUrl: string;
}

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const RELEASE_API_URL = 'https://api.github.com/repos/Potowai/github-copilot-tracker/releases/latest';
const LAST_CHECK_KEY = 'gctUpdateLastCheckAt';
const AVAILABLE_UPDATE_KEY = 'gctAvailableUpdate';
const NOTIFIED_VERSION_KEY = 'gctUpdateNotifiedVersion';
const REQUEST_TIMEOUT_MS = 10_000;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseVersion(version: string): ParsedVersion | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim());
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split('.') ?? [],
  };
}

export function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) throw new Error('Versions must use semantic versioning.');

  for (const key of ['major', 'minor', 'patch'] as const) {
    if (leftVersion[key] !== rightVersion[key]) return leftVersion[key] > rightVersion[key] ? 1 : -1;
  }

  if (leftVersion.prerelease.length === 0 || rightVersion.prerelease.length === 0) {
    if (leftVersion.prerelease.length === rightVersion.prerelease.length) return 0;
    return leftVersion.prerelease.length === 0 ? 1 : -1;
  }

  const sharedLength = Math.min(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const leftPart = leftVersion.prerelease[index];
    const rightPart = rightVersion.prerelease[index];
    if (leftPart === rightPart) continue;

    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Number(leftPart) > Number(rightPart) ? 1 : -1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart > rightPart ? 1 : -1;
  }

  if (leftVersion.prerelease.length === rightVersion.prerelease.length) return 0;
  return leftVersion.prerelease.length > rightVersion.prerelease.length ? 1 : -1;
}

function isTrustedReleaseUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.host === 'github.com'
      && url.pathname.startsWith('/Potowai/github-copilot-tracker/releases/tag/');
  } catch {
    return false;
  }
}

function isAvailableUpdate(value: unknown): value is AvailableUpdate {
  if (!value || typeof value !== 'object') return false;
  const update = value as Record<string, unknown>;
  return typeof update.version === 'string'
    && parseVersion(update.version) !== null
    && isTrustedReleaseUrl(update.releaseUrl);
}

export function getTimeUntilNextUpdateCheck(now = Date.now()): number {
  const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY));
  if (!Number.isFinite(lastCheck) || lastCheck <= 0 || now < lastCheck) return 0;
  return Math.max(0, UPDATE_CHECK_INTERVAL_MS - (now - lastCheck));
}

export function shouldCheckForUpdates(now = Date.now()): boolean {
  return getTimeUntilNextUpdateCheck(now) === 0;
}

export function markUpdateCheckAttempt(now = Date.now()): void {
  localStorage.setItem(LAST_CHECK_KEY, String(now));
}

export function getCachedAvailableUpdate(): AvailableUpdate | null {
  try {
    const cached = localStorage.getItem(AVAILABLE_UPDATE_KEY);
    if (!cached) return null;
    const update: unknown = JSON.parse(cached);
    if (isAvailableUpdate(update)) return update;
  } catch {
    // Discard malformed local update data and continue without a banner.
  }

  localStorage.removeItem(AVAILABLE_UPDATE_KEY);
  return null;
}

export function cacheAvailableUpdate(update: AvailableUpdate): void {
  localStorage.setItem(AVAILABLE_UPDATE_KEY, JSON.stringify(update));
}

export function clearCachedAvailableUpdate(): void {
  localStorage.removeItem(AVAILABLE_UPDATE_KEY);
}

export function wasUpdateNotificationSent(version: string): boolean {
  return localStorage.getItem(NOTIFIED_VERSION_KEY) === version;
}

export function markUpdateNotificationSent(version: string): void {
  localStorage.setItem(NOTIFIED_VERSION_KEY, version);
}

export async function fetchAvailableUpdate(
  currentVersion: string,
  fetcher: typeof fetch = fetch,
): Promise<AvailableUpdate | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetcher(RELEASE_API_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub Releases returned HTTP ${response.status}.`);

    const release: unknown = await response.json();
    if (!release || typeof release !== 'object') throw new Error('GitHub returned an invalid release response.');

    const { tag_name: tag, html_url: releaseUrl } = release as Record<string, unknown>;
    if (typeof tag !== 'string' || !parseVersion(tag) || !isTrustedReleaseUrl(releaseUrl)) {
      throw new Error('GitHub returned invalid release metadata.');
    }

    return compareVersions(tag, currentVersion) > 0
      ? { version: tag, releaseUrl }
      : null;
  } finally {
    clearTimeout(timeout);
  }
}
