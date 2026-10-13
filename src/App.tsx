import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react';
import { fetchCopilotUsage, calculatePercentage, formatCopilotPlan, getStoredToken, storeToken } from './services/copilot';
import { fetchClaudeUsage, getClaudeStatus, primaryWindow, formatResetsAt } from './services/claude';
import { startAuthFlow, completeAuthFlow, closeAuthServer } from './services/auth';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { convertAiCreditsToEuro, fetchUsdToEurRate, formatEuroAmount, getCachedUsdToEurRate } from './services/currency';
import { USAGE_SOURCE_LABELS, type ClaudeStatus, type ClaudeUsage, type CopilotUsage } from './types';
import './App.css';
import { useTray } from './contexts/TrayContext';
import ProgressBar from './components/ProgressBar';

const REFRESH_OPTIONS = [1, 5, 15, 30];
const DEFAULT_REFRESH_MINUTES = 5;
const ALWAYS_ON_TOP_STORAGE_KEY = 'usageAlwaysOnTop';

function App() {
  const { setText, updateMenu, source, setSource } = useTray();

  const [userCode, setUserCode] = useState<string>('');
  const [usage, setUsage] = useState<CopilotUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);

  // Claude usage comes from the Claude Code login already on this machine, so there is
  // no sign-in flow here - only a status check and the usage fetch.
  const [claudeUsage, setClaudeUsage] = useState<ClaudeUsage | null>(null);
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [usdToEurRate, setUsdToEurRate] = useState(() => getCachedUsdToEurRate());

  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const v = localStorage.getItem('refreshInterval');
    const n = v ? parseInt(v, 10) : DEFAULT_REFRESH_MINUTES;
    return REFRESH_OPTIONS.includes(n) ? n : DEFAULT_REFRESH_MINUTES;
  });

  // Auth flow state
  const [authState, setAuthState] = useState<{
    userCode: string;
    verificationUri: string;
    deviceCode: string;
    interval: number;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [compactSize, setCompactSize] = useState({ width: 446, height: 136 });
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(() =>
    localStorage.getItem(ALWAYS_ON_TOP_STORAGE_KEY) === '1'
  );
  const [pinning, setPinning] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const refreshRate = () => {
      void fetchUsdToEurRate()
        .then((rate) => {
          if (isActive) setUsdToEurRate(rate);
        })
        .catch((error) => {
          console.debug('Could not refresh USD/EUR rate; using the cached rate if available:', error);
        });
    };

    refreshRate();
    const refreshInterval = window.setInterval(refreshRate, 24 * 60 * 60 * 1000);
    return () => {
      isActive = false;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const loadClaudeUsage = useCallback(async () => {
    setClaudeLoading(true);
    setClaudeError(null);
    try {
      const data = await fetchClaudeUsage();
      setClaudeUsage(data);
    } catch (err) {
      setClaudeUsage(null);
      setClaudeError(err instanceof Error ? err.message : String(err));
    } finally {
      setClaudeLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken) {
      setToken(storedToken);
      setHasToken(true);
      loadUsage(storedToken);
    }

    // Detect the Claude Code login, then pick a source that can actually show something.
    getClaudeStatus()
      .then((status) => {
        setClaudeStatus(status);
        if (status.available) {
          loadClaudeUsage();
          if (!storedToken) setSource('claude');
        } else {
          setSource('copilot');
        }
      })
      .catch(() => {
        setClaudeStatus({ available: false, subscription_type: null, expired: false, reason: null });
        setSource('copilot');
      });
  }, []);

  useEffect(() => {
    if (!hasToken || !token) return;

    const interval = setInterval(() => {
      loadUsage(token);
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [hasToken, token, refreshInterval]);

  const checkAndNotify = async (data: CopilotUsage) => {
    const pct = calculatePercentage(data.premium_requests_used, data.premium_requests_limit);
    // Dedup per billing cycle so each threshold only ever alerts once.
    const key = data.billing_cycle_end;
    const threshold = pct >= 90 ? 90 : pct >= 80 ? 80 : null;
    if (threshold === null) return;

    const storageKey = `notified_${threshold}_${key}`;
    if (localStorage.getItem(storageKey)) return;

    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        granted = (await requestPermission()) === 'granted';
      }
      if (!granted) return;

      const euroRate = getCachedUsdToEurRate();
      const euroEquivalent = euroRate
        ? ` — approx. ${formatEuroAmount(convertAiCreditsToEuro(data.premium_requests_used, euroRate.rate))} equivalent value`
        : '';
      await sendNotification({
        title: 'Copilot AI Credits Alert',
        body: `${threshold}% of AI credits used (${data.premium_requests_used}/${data.premium_requests_limit})${euroEquivalent}`,
      });
      localStorage.setItem(storageKey, '1');
    } catch (e) {
      console.debug('Failed to send usage notification:', e);
    }
  };

  useEffect(() => {
    if (!claudeStatus?.available) return;

    const interval = setInterval(loadClaudeUsage, refreshInterval * 60 * 1000);
    return () => clearInterval(interval);
  }, [claudeStatus?.available, loadClaudeUsage, refreshInterval]);

  const loadUsage = async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCopilotUsage(authToken);
      setUsage(data);
      checkAndNotify(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (token.trim()) {
      storeToken(token);
      setHasToken(true);
      loadUsage(token);
      // Close the auth server if it's running
      try {
        await closeAuthServer();
      } catch {
        // Ignore errors - server might not be running
      }
      setAuthState(null);
    }
  };

  const handleRefresh = useCallback(() => {
    if (source === 'claude') {
      loadClaudeUsage();
    } else if (token) {
      loadUsage(token);
    }
  }, [source, token, loadClaudeUsage]);

  const startPollingForToken = async (
    deviceCode: string,
    intervalSeconds = 5,
    attempts = 0
  ) => {
    try {
      const authToken = await completeAuthFlow(deviceCode);
      setToken(authToken);
      storeToken(authToken);
      setHasToken(true);
      loadUsage(authToken);
      setAuthState(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isPending =
        message.includes('authorization_pending') ||
        message.includes('Authorization is still pending') ||
        message.includes('slow_down');

      if (!isPending) {
        setAuthError(message || 'Authentication failed');
        setAuthState(null);
        return;
      }

      if (attempts >= 30) { // Max 5 minutes (30 attempts at 10 seconds each)
        setAuthError('Authentication timed out after 5 minutes');
        setAuthState(null);
        return;
      }
      setTimeout(() => {
        startPollingForToken(deviceCode, intervalSeconds, attempts + 1);
      }, Math.max(5, intervalSeconds) * 1000);
    }
  };

  const handleStartAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    console.log("Starting auth flow");
    try {
      const result = await startAuthFlow();
      console.log("Auth flow started", result);
      setAuthState({
        userCode: result.user_code,
        verificationUri: result.verification_uri,
        deviceCode: result.device_code,
        interval: result.interval,
      });

      // Open the verification URL in default browser
      await openUrl(result.verification_uri);
      setUserCode(result.user_code);

      console.log("Starting polling");
      startPollingForToken(result.device_code, result.interval);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to start authentication');
    } finally {
      setAuthLoading(false);
    }
  };

  const premiumPercentage = useMemo(() => {
    const value = usage ? calculatePercentage(usage.premium_requests_used, usage.premium_requests_limit) : 0;
    return value;
  }, [usage?.premium_requests_used, usage?.premium_requests_limit]);

  const premiumEuroEquivalent = useMemo(() => (
    usage && usdToEurRate
      ? convertAiCreditsToEuro(usage.premium_requests_used, usdToEurRate.rate)
      : null
  ), [usage?.premium_requests_used, usdToEurRate]);

  const claudePrimary = useMemo(() => primaryWindow(claudeUsage), [claudeUsage]);

  // The single number the menu bar shows for the selected source.
  const activePercentage = source === 'claude' ? claudePrimary?.percent ?? 0 : premiumPercentage;
  const hasActiveData = source === 'claude' ? claudeUsage !== null : usage !== null;

  useEffect(() => () => {
    dragCleanupRef.current?.();
  }, []);

  useEffect(() => {
    const detailsHeight = Math.min(900, Math.max(compactSize.height, 680));
    void getCurrentWindow().setSize(
      new LogicalSize(compactSize.width, expanded ? detailsHeight : compactSize.height)
    );
  }, [compactSize, expanded]);

  useEffect(() => {
    if (localStorage.getItem(ALWAYS_ON_TOP_STORAGE_KEY) !== '1') return;
    void getCurrentWindow().setAlwaysOnTop(true).catch((error) => {
      console.error('Failed to restore always-on-top setting:', error);
      localStorage.setItem(ALWAYS_ON_TOP_STORAGE_KEY, '0');
      setAlwaysOnTop(false);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen('usage-widget-unpinned', () => {
      localStorage.setItem(ALWAYS_ON_TOP_STORAGE_KEY, '0');
      setAlwaysOnTop(false);
    }).then((stopListening) => {
      if (disposed) stopListening();
      else unlisten = stopListening;
    }).catch((error) => {
      console.error('Failed to listen for widget unpin events:', error);
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const copilotPlan = useMemo(() => formatCopilotPlan(usage), [usage]);

  useEffect(() => {
    const totalBlocks = 5;
    const pct = Math.max(0, Math.min(100, activePercentage));
    const filledBlocks = Math.round((pct / 100) * totalBlocks);
    const progressBar = '▰'.repeat(filledBlocks) + '▱'.repeat(totalBlocks - filledBlocks);
    setText(hasActiveData ? ` ${progressBar} ${activePercentage}%` : ' —');
  }, [activePercentage, hasActiveData, setText]);

  useEffect(() => {
    localStorage.setItem('refreshInterval', String(refreshInterval));
  }, [refreshInterval]);

  useEffect(() => {
    updateMenu({
      copilot: usage
        ? {
            premiumUsed: usage.premium_requests_used,
            premiumLimit: usage.premium_requests_limit,
            premiumRemaining: Math.max(0, usage.premium_requests_limit - usage.premium_requests_used),
            premiumEuroEquivalent: premiumEuroEquivalent === null ? null : formatEuroAmount(premiumEuroEquivalent),
            plan: copilotPlan,
            organizations: usage.organizations,
          }
        : null,
      claude: claudeUsage
        ? {
            windows: claudeUsage.windows.map((window) => ({
              label: window.label,
              percent: window.percent,
              resetsAt: formatResetsAt(window.resets_at),
            })),
          }
        : null,
      claudeAvailable: claudeStatus?.available ?? false,
    }, handleRefresh);
  }, [usage, copilotPlan, premiumEuroEquivalent, claudeUsage, claudeStatus?.available, updateMenu, handleRefresh]);

  const sourcePicker = (
    <div className="source-picker">
      {(Object.keys(USAGE_SOURCE_LABELS) as Array<keyof typeof USAGE_SOURCE_LABELS>).map((option) => (
        <button
          key={option}
          className={`source-tab ${source === option ? 'active' : ''}`}
          onClick={() => setSource(option)}
          disabled={option === 'claude' && !claudeStatus?.available}
        >
          {USAGE_SOURCE_LABELS[option]}
        </button>
      ))}
    </div>
  );

  const refreshControl = (
    <div className="refresh-control">
      <label>
        Auto-refresh:{' '}
        <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}>
          {REFRESH_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 1 ? '1 min' : `${minutes} mins`}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  const dashboard = (() => {
  if (source === 'claude') {
    return (
      <div className="container">
        <h1>Claude Usage</h1>
        {sourcePicker}

        {claudeStatus && !claudeStatus.available && (
          <div className="token-setup">
            <p>
              No Claude Code login was found on this Mac. Sign in with the Claude Code CLI
              (<code>claude</code> in a terminal, then <code>/login</code>) and refresh.
            </p>
            {claudeStatus?.reason && <div className="error">{claudeStatus.reason}</div>}
          </div>
        )}

        {claudeStatus?.available && claudeStatus.expired && !claudeError && (
          <div className="status">
            The stored Claude login has expired. Run the Claude Code CLI once to refresh it.
          </div>
        )}

        {claudeLoading && <div className="status">Loading...</div>}
        {claudeError && <div className="error">{claudeError}</div>}

        {claudeUsage && (
          <>
            <div className="usage-section">
              {claudeUsage.windows.map((window) => (
                <ProgressBar
                  key={window.key}
                  label={window.label}
                  percent={window.percent}
                  className="claude-window"
                  variant="claude"
                />
              ))}
            </div>

            {refreshControl}

            <div className="billing-info">
              {claudePrimary?.resets_at && (
                <p>{claudePrimary.label} resets: {formatResetsAt(claudePrimary.resets_at)}</p>
              )}
            </div>
          </>
        )}

        <div className="actions">
          <button onClick={handleRefresh} disabled={claudeLoading} className="btn-primary">
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="container">
        <h1>GCT</h1>
        {sourcePicker}
        <div className="token-setup">
          <p>Enter your GitHub Personal Access Token or use the GitHub login</p>

          <button
            onClick={handleStartAuth}
            disabled={authLoading || authState !== null}
            className="btn-github"
          >
            {authLoading ? 'Starting...' : '🔑 Login with GitHub'}
          </button>

          {authState && (
            <div className="auth-code-section">
              <p>Enter this code at <a href={authState.verificationUri} target="_blank" rel="noopener noreferrer">{authState.verificationUri}</a>:</p>
              <div className="user-code">{authState.userCode}</div>
              <p className="auth-status">Waiting for authorization...</p>
            </div>
          )}

          {
            userCode && !authState && (
              <div className="auth-code-section">
                <p>If you haven't authorized yet, go to <a href="https://github.com/login/device" target="_blank" rel="noopener noreferrer">https://github.com/login/device</a> and enter the code:</p>
                <div className="user-code">{userCode}</div>
              </div>
            )
          }

          {authError && <div className="error">{authError}</div>}

          <div className="divider">
            <span>or enter token manually</span>
          </div>

          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            className="token-input"
          />
          <button onClick={() => setToken('')} className="btn-secondary">
            Clear
          </button>
          <button onClick={handleSaveToken} className="btn-primary">
            Save Token
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>GCT</h1>
      {sourcePicker}

      {loading && <div className="status">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {usage && (
        <>
          <div className="usage-section">
            <ProgressBar
              label="AI Credits"
              percent={premiumPercentage}
              used={usage.premium_requests_used}
              limit={usage.premium_requests_limit}
              variant="premium"
              euroEquivalent={premiumEuroEquivalent}
              euroRateDate={usdToEurRate?.date}
            />
          </div>

          {refreshControl}

          <div className="billing-info">
            {copilotPlan && (
              <p>
                License: <strong>{copilotPlan}</strong>
                {usage.organizations.length > 0 && ` (${usage.organizations.join(', ')})`}
              </p>
            )}
            <p>Billing: {new Date(usage.billing_cycle_end).toLocaleDateString()}</p>
          </div>
        </>
      )}

      <div className="actions">
        <button onClick={handleRefresh} disabled={loading} className="btn-primary">
          Refresh
        </button>
        <button onClick={() => { localStorage.removeItem('github_token'); setHasToken(false); setUsage(null); }} className="btn-secondary">
          Change Token
        </button>
      </div>
    </div>
  );
  })();

  const filledSegments = hasActiveData
    ? Math.round(Math.max(0, Math.min(100, activePercentage)) / 20)
    : 0;

  const handlePillDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('.pill-controls')) return;

    dragCleanupRef.current?.();
    const startX = event.screenX;
    const startY = event.screenY;
    let cleanup = () => {};

    const handleMove = (moveEvent: globalThis.MouseEvent) => {
      if (Math.hypot(moveEvent.screenX - startX, moveEvent.screenY - startY) < 5) return;
      cleanup();
      void getCurrentWindow().startDragging().catch((dragError) => {
        console.error('Failed to move usage pill:', dragError);
      });
    };
    const handleMouseUp = () => cleanup();

    cleanup = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragCleanupRef.current === cleanup) dragCleanupRef.current = null;
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
  };

  const handleToggleAlwaysOnTop = async () => {
    const nextValue = !alwaysOnTop;
    setPinning(true);
    setPinError(null);
    try {
      await getCurrentWindow().setAlwaysOnTop(nextValue);
      localStorage.setItem(ALWAYS_ON_TOP_STORAGE_KEY, nextValue ? '1' : '0');
      setAlwaysOnTop(nextValue);
    } catch (error) {
      console.error('Failed to toggle always-on-top:', error);
      setPinError('Pin failed');
    } finally {
      setPinning(false);
    }
  };

  const handleHideWidget = async () => {
    setAlwaysOnTop(false);
    localStorage.setItem(ALWAYS_ON_TOP_STORAGE_KEY, '0');
    try {
      await invoke('hide_window');
    } catch (error) {
      console.error('Failed to hide usage widget:', error);
    }
  };

  const handleToggleDetails = () => {
    if (!expanded) {
      setCompactSize({
        width: Math.min(900, Math.max(260, Math.round(window.innerWidth))),
        height: Math.min(900, Math.max(76, Math.round(window.innerHeight))),
      });
      setExpanded(true);
      return;
    }

    setExpanded(false);
  };

  return (
    <main className="widget-shell">
      <div className="usage-pill" role="group" aria-label="Usage widget" onMouseDown={handlePillDrag}>
        <button
          type="button"
          className="pill-main"
          aria-label={`${USAGE_SOURCE_LABELS[source]} usage ${hasActiveData ? `${Math.round(activePercentage)} percent` : 'unavailable'}. Click for details.`}
          aria-expanded={expanded}
          title="Click for details; hover for options; drag anywhere on the pill to move and resize from the edges."
          onClick={handleToggleDetails}
        >
          <img className="pill-icon" src="/copilot-mark.png" alt="" draggable="false" />
          <div className="pill-meter" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span
                key={index}
                className={`meter-segment${index < filledSegments ? ' is-filled' : ''}`}
              />
            ))}
          </div>
          <span className="pill-percentage">
            {hasActiveData ? `${Math.round(activePercentage)}%` : '—'}
          </span>
        </button>
        <div className="pill-controls" role="toolbar" aria-label="Widget options">
          <button
            type="button"
            className={`widget-control widget-control-pin${alwaysOnTop ? ' is-active' : ''}`}
            aria-label={pinError ?? (alwaysOnTop ? 'Unpin from top' : 'Pin on top')}
            aria-pressed={alwaysOnTop}
            disabled={pinning}
            title={pinError ?? (alwaysOnTop ? 'Stop keeping the widget on top' : 'Keep the widget on top')}
            onClick={() => void handleToggleAlwaysOnTop()}
          >
            <svg className="widget-control-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 4h8l-1 5 3 3v2H6v-2l3-3-1-5Z" />
              <path d="M12 14v7" />
            </svg>
            <span className="widget-control-label">
              {pinning ? 'Pinning' : pinError ?? (alwaysOnTop ? 'Pinned' : 'Pin on top')}
            </span>
          </button>
          <button
            type="button"
            className={`widget-control${expanded ? ' is-active' : ''}`}
            aria-label={expanded ? 'Close usage details' : 'Open usage details'}
            aria-pressed={expanded}
            title={expanded ? 'Close details' : 'Open usage details'}
            onClick={handleToggleDetails}
          >
            <svg className="widget-control-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5v15h16" />
              <path d="M8 16v-3M13 16V8M18 16v-6" />
            </svg>
            <span className="widget-control-label">{expanded ? 'Close' : 'Details'}</span>
          </button>
          <button
            type="button"
            className="widget-control widget-control-hide"
            aria-label="Hide widget to system tray"
            title="Hide widget to system tray"
            onClick={() => void handleHideWidget()}
          >
            <svg className="widget-control-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            <span className="widget-control-label">Hide</span>
          </button>
        </div>
      </div>

      {expanded && (
        <section className="details-panel" aria-label="Usage details">
          <button
            type="button"
            className="details-close"
            aria-label="Close details"
            onClick={() => setExpanded(false)}
          >
            ×
          </button>
          {dashboard}
        </section>
      )}
    </main>
  );
}

export default App;
