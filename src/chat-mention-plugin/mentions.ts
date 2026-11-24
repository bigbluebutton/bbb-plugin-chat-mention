interface Mention {
  // Position of the "@" in the text.
  index: number;
  // Length including the "@".
  length: number;
  name: string;
}

function isWordChar(char: string): boolean {
  if (!char) return false;
  return /[0-9_]/.test(char) || char.toLowerCase() !== char.toUpperCase();
}

/**
 * Finds the mentions of the given names in `text`. Names are compared as
 * plain text, so characters like "+" or "(" need no escaping. At every "@" the
 * longest matching name wins, so "@Anna Maria" mentions "Anna Maria" and not
 * "Anna". Matching is case-insensitive and a name must not continue with a
 * letter or digit ("@Anna," mentions "Anna", "@Annabel" does not). An "@"
 * inside a word, as in "anna@example.org", is not a mention.
 */
export function findMentions(text: string, names: string[]): Mention[] {
  const candidates = names
    .filter((name) => name.trim() !== '')
    .map((name) => ({ name, lower: name.toLowerCase() }))
    .sort((a, b) => b.name.length - a.name.length);
  const mentions: Mention[] = [];

  let index = text.indexOf('@');
  while (index !== -1) {
    const start = index + 1;
    const isMentionStart = index === 0 || !isWordChar(text.charAt(index - 1));
    const match = isMentionStart && candidates.find(({ name, lower }) => {
      const end = start + name.length;
      return text.slice(start, end).toLowerCase() === lower && !isWordChar(text.charAt(end));
    });

    if (match) {
      mentions.push({ index, length: match.name.length + 1, name: match.name });
      index = text.indexOf('@', start + match.name.length);
    } else {
      index = text.indexOf('@', start);
    }
  }

  return mentions;
}

export function findMentionedNames(text: string, names: string[]): string[] {
  return findMentions(text, names).map((mention) => mention.name);
}

/**
 * Wraps every mention inside `root` in a span with the given inline style.
 * Only text nodes are changed, so markup such as link targets stays intact.
 */
export function highlightMentions(root: HTMLElement, names: string[], style: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((textNode) => {
    const text = textNode.data;
    const mentions = findMentions(text, names);
    if (mentions.length === 0) return;

    const fragment = document.createDocumentFragment();
    let position = 0;
    mentions.forEach(({ index, length }) => {
      fragment.appendChild(document.createTextNode(text.slice(position, index)));
      const highlight = document.createElement('span');
      highlight.setAttribute('style', style);
      highlight.textContent = text.slice(index, index + length);
      fragment.appendChild(highlight);
      position = index + length;
    });
    fragment.appendChild(document.createTextNode(text.slice(position)));
    textNode.parentNode?.replaceChild(fragment, textNode);
  });
}
