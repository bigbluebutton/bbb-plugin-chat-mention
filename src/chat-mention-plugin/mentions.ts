function isWordChar(char: string): boolean {
  if (!char) return false;
  return /[0-9_]/.test(char) || char.toLowerCase() !== char.toUpperCase();
}

/**
 * Returns the names mentioned in `text`. At every "@" the longest matching
 * name wins, so "@Anna Maria" mentions "Anna Maria" and not "Anna". Matching
 * is case-insensitive and a name must not continue with a letter or digit
 * ("@Anna," mentions "Anna", "@Annabel" does not). An "@" inside a word, as in
 * "anna@example.org", is not a mention.
 */
export function findMentionedNames(text: string, names: string[]): string[] {
  const lowerText = text.toLowerCase();
  const candidates = names
    .filter((name) => name.trim() !== '')
    .map((name) => ({ name, lower: name.toLowerCase() }))
    .sort((a, b) => b.lower.length - a.lower.length);
  const mentioned: string[] = [];

  let index = lowerText.indexOf('@');
  while (index !== -1) {
    const start = index + 1;
    // An "@" right after a letter or digit is part of a word, e.g. an e-mail address.
    const isMentionStart = index === 0 || !isWordChar(lowerText.charAt(index - 1));
    const match = isMentionStart && candidates.find(({ lower }) => (
      lowerText.startsWith(lower, start) && !isWordChar(lowerText.charAt(start + lower.length))
    ));
    if (match) mentioned.push(match.name);
    index = lowerText.indexOf('@', start);
  }

  return mentioned;
}
