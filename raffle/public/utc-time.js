const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

export function formatUtc(timestamp) {
  return formatter.format(Number(timestamp) * 1000) + ' UTC';
}
