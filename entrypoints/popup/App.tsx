import { useEffect, useState } from 'react';
import {
  DEFAULT_WEBVIM_ENABLED,
  WEBVIM_ENABLED_KEY,
  getWebVimEnabled,
  setWebVimEnabled,
} from '../../core/settings';
import './App.css';

function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    let changedWhileLoading = false;

    const onStorageChanged = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local' || !(WEBVIM_ENABLED_KEY in changes)) return;

      changedWhileLoading = true;
      const value: unknown = changes[WEBVIM_ENABLED_KEY]?.newValue;
      setEnabled(
        typeof value === 'boolean' ? value : DEFAULT_WEBVIM_ENABLED,
      );
      setError(null);
    };

    browser.storage.onChanged.addListener(onStorageChanged);
    void getWebVimEnabled()
      .then((value) => {
        if (mounted && !changedWhileLoading) setEnabled(value);
      })
      .catch((loadError: unknown) => {
        console.error('[webvim] could not load settings', loadError);
        if (mounted && !changedWhileLoading) {
          setEnabled(DEFAULT_WEBVIM_ENABLED);
          setError('Could not load settings. Try reopening this popup.');
        }
      });

    return () => {
      mounted = false;
      browser.storage.onChanged.removeListener(onStorageChanged);
    };
  }, []);

  const toggleEnabled = async (): Promise<void> => {
    if (enabled === null || saving) return;

    const previous = enabled;
    const next = !previous;
    setEnabled(next);
    setSaving(true);
    setError(null);

    try {
      await setWebVimEnabled(next);
    } catch (saveError: unknown) {
      console.error('[webvim] could not save settings', saveError);
      setEnabled(previous);
      setError('Could not save this setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isLoading = enabled === null;

  return (
    <main className="popup">
      <header className="popup-header">
        <div className="brand-mark" aria-hidden="true">
          W
        </div>
        <div>
          <h1>WebVim</h1>
          <p>Vim-style editing, everywhere on the web.</p>
        </div>
      </header>

      <section className="setting-row" aria-label="WebVim setting">
        <div>
          <span className="setting-title">WebVim</span>
          <span className={`state-label ${enabled ? 'is-enabled' : ''}`}>
            <span className="state-dot" aria-hidden="true" />
            {isLoading ? 'Loading…' : enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <button
          className="toggle-button"
          type="button"
          role="switch"
          aria-label="Enable WebVim"
          aria-checked={enabled === true}
          disabled={isLoading || saving}
          onClick={() => void toggleEnabled()}
        >
          <span className="toggle-thumb" />
        </button>
      </section>

      <p className="status-copy" aria-live="polite">
        {isLoading
          ? 'Restoring your setting…'
          : enabled
            ? 'Vim controls are active on supported editors.'
            : 'Vim controls are paused on all websites.'}
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

export default App;
