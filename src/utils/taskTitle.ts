export function splitTaskTitle(value: string): { title: string; note: string } {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf('.');

  if (separatorIndex === -1) {
    return { title: trimmed, note: '' };
  }

  const title = trimmed.slice(0, separatorIndex).trim();
  const note = trimmed.slice(separatorIndex + 1).trim();

  return {
    title: title || trimmed,
    note,
  };
}
