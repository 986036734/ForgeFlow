export interface CoverageResult {
  claim: string;
  supported: boolean;
}

export interface CoverageReport {
  pass: boolean;
  results: CoverageResult[];
}

/** A claim is supported only when it is an exact substring of the tool corpus. */
export function checkCoverage(claims: string[], corpusParts: string[]): CoverageReport {
  const haystack = corpusParts.join("\n");
  const results = claims.map((claim) => {
    const trimmed = claim.trim();
    const supported = trimmed.length > 0 && haystack.includes(trimmed);
    return { claim, supported };
  });
  return {
    pass: results.length > 0 && results.every((result) => result.supported),
    results,
  };
}
