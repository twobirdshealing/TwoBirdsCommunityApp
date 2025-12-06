// =============================================================================
// FORMAT NUMBER - Human-readable number formatting
// =============================================================================
// Converts large numbers to compact form: 1200 → "1.2k"
// =============================================================================

// -----------------------------------------------------------------------------
// Format as Compact Number (1.2k, 3.5M)
// -----------------------------------------------------------------------------

export function formatCompactNumber(num: number | string): string {
  // Convert string to number if needed
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  
  // Handle invalid numbers
  if (isNaN(n)) return '0';
  
  // Less than 1000, show as-is
  if (n < 1000) {
    return n.toString();
  }
  
  // Thousands (1k - 999k)
  if (n < 1000000) {
    const k = n / 1000;
    // Show one decimal if less than 10k
    if (k < 10) {
      return `${k.toFixed(1).replace(/\.0$/, '')}k`;
    }
    return `${Math.floor(k)}k`;
  }
  
  // Millions (1M - 999M)
  if (n < 1000000000) {
    const m = n / 1000000;
    if (m < 10) {
      return `${m.toFixed(1).replace(/\.0$/, '')}M`;
    }
    return `${Math.floor(m)}M`;
  }
  
  // Billions (1B+)
  const b = n / 1000000000;
  if (b < 10) {
    return `${b.toFixed(1).replace(/\.0$/, '')}B`;
  }
  return `${Math.floor(b)}B`;
}

// -----------------------------------------------------------------------------
// Format with Commas (1,234,567)
// -----------------------------------------------------------------------------

export function formatWithCommas(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  
  if (isNaN(n)) return '0';
  
  return n.toLocaleString('en-US');
}

// -----------------------------------------------------------------------------
// Format as Percentage (0.156 → "15.6%")
// -----------------------------------------------------------------------------

export function formatPercentage(num: number, decimals: number = 0): string {
  return `${(num * 100).toFixed(decimals)}%`;
}

// -----------------------------------------------------------------------------
// Format Count with Label ("5 comments", "1 comment")
// -----------------------------------------------------------------------------

export function formatCount(count: number | string, singular: string, plural?: string): string {
  const n = typeof count === 'string' ? parseInt(count, 10) : count;
  
  if (isNaN(n)) return `0 ${plural || singular + 's'}`;
  
  const label = n === 1 ? singular : (plural || singular + 's');
  return `${formatCompactNumber(n)} ${label}`;
}

// -----------------------------------------------------------------------------
// Examples
// -----------------------------------------------------------------------------

// formatCompactNumber(500)      → "500"
// formatCompactNumber(1200)     → "1.2k"
// formatCompactNumber(15000)    → "15k"
// formatCompactNumber(1500000)  → "1.5M"
// formatCount(1, 'comment')     → "1 comment"
// formatCount(5, 'comment')     → "5 comments"
// formatCount(1200, 'like')     → "1.2k likes"

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default {
  compact: formatCompactNumber,
  commas: formatWithCommas,
  percentage: formatPercentage,
  count: formatCount,
};
