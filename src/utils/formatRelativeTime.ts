/** Lightweight relative time (avoids extra deps like date-fns). */
export function formatRelativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  let diffMs = Date.now() - then;
  if (diffMs < 0) {
    diffMs = 0;
  }
  const sec = Math.floor(diffMs / 1000);
  if (sec < 10) {
    return 'just now';
  }
  if (sec < 60) {
    return `${sec} seconds ago`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min} minute${min === 1 ? '' : 's'} ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  }
  const day = Math.floor(hr / 24);
  if (day === 1) {
    return 'yesterday';
  }
  if (day < 7) {
    return `${day} days ago`;
  }
  return new Date(then).toLocaleDateString();
}

export function truncateFileName(name: string, maxChars: number): string {
  if (name.length <= maxChars) {
    return name;
  }
  return `${name.slice(0, maxChars - 1)}…`;
}
