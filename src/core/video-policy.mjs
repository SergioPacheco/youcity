export function getEffectiveStartSeconds(ride, minimum = 15) {
  const configuredStart = Number(ride?.start);
  return Math.max(minimum, Number.isFinite(configuredStart) ? configuredStart : 0);
}
