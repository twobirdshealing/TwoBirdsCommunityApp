// =============================================================================
// VERSION UTILS - Semver comparison for force-update gate
// =============================================================================

/**
 * Returns true if `current` is below `minimum` (semver: major.minor.patch).
 * Returns false if either string is empty or invalid.
 */
export function isVersionBelow(current: string, minimum: string): boolean {
  if (!current || !minimum) return false;
  const parse = (v: string) => v.split('.').map(Number);
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);
  const [mMaj = 0, mMin = 0, mPat = 0] = parse(minimum);
  if (cMaj !== mMaj) return cMaj < mMaj;
  if (cMin !== mMin) return cMin < mMin;
  return cPat < mPat;
}
