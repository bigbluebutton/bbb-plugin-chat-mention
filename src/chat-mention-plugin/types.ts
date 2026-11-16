interface ChatMentionProps {
    pluginName: string,
    pluginUuid: string,
}

interface MentionUser {
    userId: string,
    name: string,
    color: string,
}

export { ChatMentionProps, MentionUser };
