'use client';

import { useEffect, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { encryptionKeyId, generateEncryptionKey, isValidEncryptionKey } from '@/services/gistCrypto';

const panelStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  background: 'var(--task-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
};

const buttonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--foreground)',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 650,
};

const primaryStyle: React.CSSProperties = {
  ...buttonStyle,
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: 'var(--background)',
  fontWeight: 750,
};

const keyStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  marginBottom: 10,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-inset)',
  color: 'var(--foreground)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 14,
  wordBreak: 'break-all',
};

/**
 * End-to-end encryption for the sync Gist. The key lives in the user's password manager and in
 * each device's settings; GitHub only stores ciphertext.
 */
export default function EncryptionSettings() {
  const { gistSettings, updateGistSettings, isGistConfigured } = useSettings();
  const [computedKeyId, setComputedKeyId] = useState<{ key: string; id: string } | null>(null);
  const keyId = computedKeyId && computedKeyId.key === gistSettings.encryptionKey ? computedKeyId.id : null;
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const [enteredKey, setEnteredKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = gistSettings.encryptionKey;
    if (!key || !isValidEncryptionKey(key)) return;
    let cancelled = false;
    void encryptionKeyId(key).then((id) => { if (!cancelled) setComputedKeyId({ key, id }); });
    return () => { cancelled = true; };
  }, [gistSettings.encryptionKey]);

  if (!isGistConfigured) return null;

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const saveKey = (value: string | undefined) => {
    const trimmed = value?.replace(/\s+/g, '');
    if (trimmed && !isValidEncryptionKey(trimmed)) {
      setError("That doesn't look like a Juice key. It should be 43 characters.");
      return;
    }
    setError(null);
    setDraftKey(null);
    setIsEntering(false);
    setEnteredKey('');
    setIsConfirmingRemove(false);
    // Changing the key re-runs the sync, which encrypts the Gist if it isn't already.
    updateGistSettings({ encryptionKey: trimmed });
  };

  return (
    <div style={panelStyle}>
      <div style={{ color: 'var(--foreground)', fontSize: 15, fontWeight: 700 }}>
        Encryption {keyId && <span style={{ color: 'var(--green)', fontWeight: 650 }}>· On</span>}
      </div>
      <p style={{ margin: '6px 0 12px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.45 }}>
        Encrypts the Gist with a key only your devices know, so GitHub and anyone with the link see only
        scrambled data. Use the same key on every device, including the iPhone app. If you lose it, the Gist
        can&apos;t be read.
      </p>

      {error && (
        <p style={{ margin: '0 0 10px', color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>{error}</p>
      )}

      {keyId && !draftKey && (
        <>
          <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 13 }}>
            Key ID <code style={{ color: 'var(--foreground)' }}>{keyId}</code>
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={() => void copy(gistSettings.encryptionKey ?? '')}>
              {copied ? 'Copied' : 'Copy key'}
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, borderColor: 'var(--red)', color: isConfirmingRemove ? 'var(--background)' : 'var(--red)', background: isConfirmingRemove ? 'var(--red)' : 'transparent' }}
              onClick={() => (isConfirmingRemove ? saveKey(undefined) : setIsConfirmingRemove(true))}
            >
              {isConfirmingRemove ? 'Confirm: stop syncing here' : 'Remove key from this browser'}
            </button>
          </div>
        </>
      )}

      {draftKey && (
        <>
          <p style={{ margin: '0 0 8px', color: 'var(--foreground)', fontSize: 13, fontWeight: 650 }}>
            Save this key in your password manager first.
          </p>
          <div style={keyStyle}>{draftKey}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={() => void copy(draftKey)}>
              {copied ? 'Copied' : 'Copy key'}
            </button>
            <button type="button" style={primaryStyle} onClick={() => saveKey(draftKey)}>
              I saved it. Encrypt my Gist
            </button>
            <button type="button" style={{ ...buttonStyle, color: 'var(--muted)' }} onClick={() => setDraftKey(null)}>
              Cancel
            </button>
          </div>
        </>
      )}

      {!keyId && !draftKey && !isEntering && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={primaryStyle} onClick={() => setDraftKey(generateEncryptionKey())}>
            Turn on encryption
          </button>
          <button type="button" style={buttonStyle} onClick={() => setIsEntering(true)}>
            Enter existing key
          </button>
        </div>
      )}

      {isEntering && (
        <form onSubmit={(event) => { event.preventDefault(); saveKey(enteredKey); }}>
          <input
            type="password"
            autoComplete="off"
            value={enteredKey}
            onChange={(event) => setEnteredKey(event.target.value)}
            placeholder="Paste key from your password manager"
            style={{ ...keyStyle, fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={primaryStyle} disabled={!enteredKey}>Save key</button>
            <button type="button" style={{ ...buttonStyle, color: 'var(--muted)' }} onClick={() => { setIsEntering(false); setEnteredKey(''); }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.45 }}>
        GitHub keeps every earlier version of a Gist. After turning this on, delete the old Gist on GitHub;
        Juice will create a new one that has only ever held encrypted data.
      </p>
    </div>
  );
}
