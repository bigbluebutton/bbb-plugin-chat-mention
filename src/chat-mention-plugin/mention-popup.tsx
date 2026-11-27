import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { PluginApi, ChatFormUiDataNames } from 'bigbluebutton-html-plugin-sdk';
import { MentionUser } from './types';

const MAX_RESULTS = 5;

interface MentionPopupProps {
  pluginApi: PluginApi;
  users: MentionUser[];
}

// Matches an in-progress mention at the end of the chat input, e.g. "hi @jo".
// Group 1 keeps the leading character (start of string or whitespace) so it
// can be preserved when the mention is completed; group 2 is the typed query.
const MENTION_TYPING_REGEX = /(^|\s)@([^\s@]*)$/;

function getMatches(users: MentionUser[], query: string): MentionUser[] {
  const normalizedQuery = query.toLowerCase();

  return users
    .filter((user) => normalizedQuery === '' || user.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.length - b.name.length;
    })
    .slice(0, MAX_RESULTS);
}

// BBB 4.0.4 leaves CHAT_INPUT_IS_FOCUSED at false when the client focuses the
// chat input itself (e.g. after the audio dialog closes). The focused element
// is therefore checked as well: it is the chat input when it holds the same text.
function getFocusedChatInput(text: string): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    return active.value === text ? active : null;
  }
  return null;
}

function MentionPopup({ pluginApi, users }: MentionPopupProps): React.ReactElement | null {
  // Reactive chat-input state coming from the BBB client.
  const inputText = pluginApi.useUiData!(
    ChatFormUiDataNames.CURRENT_CHAT_INPUT_TEXT,
    { text: '' },
  );
  const inputFocus = pluginApi.useUiData!(
    ChatFormUiDataNames.CHAT_INPUT_IS_FOCUSED,
    { value: false },
  );

  // Keep a reference to the chat input element so the popup can be anchored to it.
  const inputElementRef = useRef<HTMLElement | null>(null);
  const [, forceReposition] = useState(0);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);

  useEffect(() => {
    if (inputFocus.value && document.activeElement instanceof HTMLElement) {
      inputElementRef.current = document.activeElement;
    }
  }, [inputFocus.value]);

  useEffect(() => {
    const reposition = () => forceReposition((value) => value + 1);
    // Focus events fire while the focus is still moving, so it is read afterwards.
    let focusTimer: number | undefined;
    const onFocusChange = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(reposition, 0);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
    };
  }, []);

  const text = inputText.text ?? '';
  const focusedInput = getFocusedChatInput(text);
  const match = text.match(MENTION_TYPING_REGEX);
  const query = match ? match[2] : null;
  const matches = query !== null ? getMatches(users, query) : [];

  if ((!inputFocus.value && !focusedInput) || query === null || matches.length === 0) {
    return null;
  }

  const anchor = focusedInput ?? inputElementRef.current;
  const rect = anchor?.getBoundingClientRect();

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: rect ? rect.left : 16,
    bottom: rect ? window.innerHeight - rect.top + 4 : 80,
    width: rect ? rect.width : 280,
    maxWidth: 320,
    maxHeight: 220,
    overflowY: 'auto',
    zIndex: 9999,
    background: '#fff',
    border: '1px solid #d4d9df',
    borderRadius: 6,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    fontFamily: 'inherit',
    fontSize: 14,
  };

  const handleSelect = (user: MentionUser) => {
    const newText = text.replace(MENTION_TYPING_REGEX, (_full, leading) => `${leading}@${user.name} `);
    pluginApi.uiCommands?.chat.form.fill({ text: newText });
  };

  return (
    <div
      style={containerStyle}
      role="presentation"
      // Prevent the chat input from losing focus before the click is handled.
      onMouseDown={(event) => event.preventDefault()}
    >
      {matches.map((user) => (
        <div
          key={user.userId}
          role="button"
          tabIndex={0}
          onClick={() => handleSelect(user)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') handleSelect(user);
          }}
          onMouseEnter={() => setHoveredUserId(user.userId)}
          onMouseLeave={() => setHoveredUserId(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            background: hoveredUserId === user.userId ? '#f2f6f8' : 'transparent',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: user.color || '#4185cf',
              color: '#fff',
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span>{user.name}</span>
        </div>
      ))}
    </div>
  );
}

export default MentionPopup;
