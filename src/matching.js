export function wildcardToRegex(pattern) {
  if (!pattern) return /^.*$/;
  // Escape all special regex characters except * and ?
  let escaped = pattern.replace(/[\\^$+.|()[\]{}]/g, '\\$&');
  // Replace wildcards with regex equivalents
  escaped = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(escaped, 'i');
}

export function matchText(text, pattern) {
  const regex = wildcardToRegex(pattern);
  return regex.test(text);
}
