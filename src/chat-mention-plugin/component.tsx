import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { BbbPluginSdk, PluginApi } from 'bigbluebutton-html-plugin-sdk';
import { ChatMentionProps, MentionUser } from './types';
import MentionPopup from './mention-popup';
import { useMentionNotification } from './mention-notification';
import { findMentionedNames, highlightMentions } from './mentions';

const MENTION_STYLE = 'color: #4185cf; background-color: #f2f6f8;';

function ChatMention({ pluginUuid: uuid }: ChatMentionProps): React.ReactElement {
  BbbPluginSdk.initialize(uuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(uuid);

  const [chatIdsToApplyHighlights, setChatIdsToApplyHighlights] = useState<string[]>([]);
  const response = pluginApi.useLoadedChatMessages();
  const userListBasicInf = pluginApi.useUsersBasicInfo();

  const allUserNames = useMemo(
    () => userListBasicInf.data?.user.map((user) => user.name) ?? [],
    [userListBasicInf.data],
  );
  useMentionNotification(pluginApi, allUserNames);

  useEffect(() => {
    if (response.data && userListBasicInf.data) {
      const idsToApply = response.data
        .filter((message) => findMentionedNames(message.message, allUserNames).length > 0)
        .map((message) => message.messageId);

      setChatIdsToApplyHighlights(idsToApply);
    }
  }, [response, userListBasicInf, allUserNames]);

  const chatMessagesDomElements = pluginApi.useChatMessageDomElements(chatIdsToApplyHighlights);

  useEffect(() => {
    chatMessagesDomElements?.forEach((chatMessageDomElement) => {
      const { parentElement } = chatMessageDomElement;

      if (parentElement?.getAttribute('already-styled') === 'true') return;

      parentElement?.setAttribute('already-styled', 'true');
      highlightMentions(chatMessageDomElement, allUserNames, MENTION_STYLE);
    });
  }, [chatMessagesDomElements, allUserNames]);

  const mentionableUsers: MentionUser[] = userListBasicInf.data?.user.map((user) => ({
    userId: user.userId,
    name: user.name,
    color: user.color,
  })) ?? [];

  return (
    <MentionPopup pluginApi={pluginApi} users={mentionableUsers} />
  );
}

export default ChatMention;
