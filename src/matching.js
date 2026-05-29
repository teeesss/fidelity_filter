export function wildcardToRegex(pattern) {
  if (!pattern) return /^.*$/;
  // Escape all special regex characters except * and ?
  let escaped = pattern.replace(/[\\^$+.|()[\]{}]/g, '\\$&');
  // Replace wildcards with regex equivalents
  escaped = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(escaped, 'i');
}

export function matchText(text, pattern) {
  if (!pattern) return true;
  const terms = pattern.split('&').map(p => p.trim()).filter(Boolean);
  if (terms.length === 0) return true;
  return terms.every(term => {
    const regex = wildcardToRegex(term);
    return regex.test(text);
  });
}

