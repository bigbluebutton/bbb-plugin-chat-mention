import { useEffect, useRef } from 'react';
import { NotificationTypeUiCommand, PluginApi } from 'bigbluebutton-html-plugin-sdk';
import { findMentionedNames } from './mentions';

// Same operation name and selection as the core chat alert. bbb-graphql-middleware
// manages the stream cursor of "getChatMessageStream" (e.g. on reconnect), so the
// query text must stay identical to the one in the BigBlueButton client.
const CHAT_MESSAGE_STREAM = `
  subscription getChatMessageStream($createdAt: timestamptz!) {
    chat_message_stream(
      cursor: { initial_value: { createdAt: $createdAt }, ordering: ASC},
      batch_size: 10
    ) {
      chatId
      createdAt
      message
      messageAsHtml
      messageId
      messageMetadata
      messageType
      senderName
      senderRole
      senderId
    }
  }
`;

// Sound shipped with the BigBlueButton client (public/resources/sounds/).
const MENTION_SOUND = 'notify.mp3';
const NOTIFICATION_AUTO_CLOSE_MS = 5000;
const PREVIEW_MAX_LENGTH = 80;

// Only the fields this plugin reads; the query selects more (see above).
interface StreamedChatMessage {
  message: string;
  messageId: string;
  senderName: string | null;
  senderId: string | null;
}

interface ChatMessageStreamResponse {
  chat_message_stream: StreamedChatMessage[];
}

interface BbbClientWindow extends Window {
  meetingClientSettings?: {
    public?: {
      app?: {
        cdn?: string;
        basename?: string;
      };
    };
  };
}

const MESSAGES = {
  en: {
    title: (sender: string) => `${sender} mentioned you in the chat`,
    unknownSender: 'Someone',
  },
  de: {
    title: (sender: string) => `${sender} hat Sie im Chat erwähnt`,
    unknownSender: 'Jemand',
  },
};

// The BigBlueButton client sets <html lang> to the user's locale.
function getMessages(): typeof MESSAGES.en {
  const lang = (document.documentElement.lang || navigator.language || '').toLowerCase();
  return lang.startsWith('de') ? MESSAGES.de : MESSAGES.en;
}

function getSoundUrl(): string {
  const app = (window as BbbClientWindow).meetingClientSettings?.public?.app;
  const base = app ? `${app.cdn ?? ''}${app.basename ?? ''}` : '/html5client';
  return `${base}/resources/sounds/${MENTION_SOUND}`;
}

function playMentionSound(): void {
  const audio = new Audio(getSoundUrl());
  // Play on the output device selected in BigBlueButton, like the core alerts.
  // setSinkId is missing in some browsers (e.g. Safari), so it is checked at runtime.
  const conferenceAudio = document.querySelector<HTMLAudioElement>('#remote-media');
  const sinkId = conferenceAudio?.sinkId;
  const ready = sinkId && typeof audio.setSinkId === 'function'
    ? audio.setSinkId(sinkId).catch((): void => undefined)
    : Promise.resolve();

  // play() rejects when the browser blocks autoplay; the toast still shows.
  ready.then(() => audio.play()).catch((): void => undefined);
}

function truncate(text: string, maxLength: number): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > maxLength
    ? `${singleLine.slice(0, maxLength - 1).trimEnd()}…`
    : singleLine;
}

/**
 * Plays a sound and shows a toast when another user mentions the current
 * user in a chat message sent after the plugin was loaded.
 */
export function useMentionNotification(pluginApi: PluginApi, userNames: string[]): void {
  const currentUser = pluginApi.useCurrentUser();
  // Only messages created after the plugin was loaded, like the core chat alert.
  const streamStart = useRef(new Date().toISOString());
  const handledMessageIds = useRef(new Set<string>());

  const chatStream = pluginApi.useCustomSubscription<ChatMessageStreamResponse>(
    CHAT_MESSAGE_STREAM,
    { variables: { createdAt: streamStart.current } },
  );

  const ownUserId = currentUser?.data?.userId;
  const ownName = currentUser?.data?.name;

  useEffect(() => {
    const messages = chatStream?.data?.chat_message_stream;
    if (!messages || !ownUserId || !ownName) return;

    const ownNameLower = ownName.toLowerCase();
    // The own name is added in case the user list has not loaded yet.
    const knownNames = [...userNames, ownName];

    messages.forEach((chatMessage) => {
      if (handledMessageIds.current.has(chatMessage.messageId)) return;
      handledMessageIds.current.add(chatMessage.messageId);

      if (!chatMessage.message || chatMessage.senderId === ownUserId) return;

      const isMentioned = findMentionedNames(chatMessage.message, knownNames)
        .some((name) => name.toLowerCase() === ownNameLower);
      if (!isMentioned) return;

      const texts = getMessages();
      playMentionSound();
      pluginApi.uiCommands?.notification.send({
        message: texts.title(chatMessage.senderName || texts.unknownSender),
        content: truncate(chatMessage.message, PREVIEW_MAX_LENGTH),
        icon: 'chat',
        type: NotificationTypeUiCommand.INFO,
        options: { autoClose: NOTIFICATION_AUTO_CLOSE_MS },
      });
    });
  }, [chatStream, ownUserId, ownName, userNames]);
}
