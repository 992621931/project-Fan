/**
 * NumberFormatter - Utility for formatting numbers consistently across the game
 */

/**
 * Format a number to display at most 2 decimal places
 * - If the number is an integer, display without decimal point
 * - If the number has decimals, display at most 2 decimal places
 * @param value - The number to format
 * @returns Formatted string representation of the number
 */
export function formatNumber(value: number): string {
  // Check if the number is an integer
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  // Round to 2 decimal places and remove trailing zeros
  const rounded = Math.round(value * 100) / 100;
  
  // Convert to string and remove trailing zeros after decimal point
  const str = rounded.toFixed(2);
  
  // Remove trailing zeros and decimal point if not needed
  return str.replace(/\.?0+$/, '');
}

/**
 * Format a percentage value (0-100) to display at most 2 decimal places
 * @param value - The percentage value (0-100)
 * @returns Formatted string with % symbol
 */
export function formatPercentage(value: number): string {
  return `${formatNumber(value)}%`;
}

/**
 * Format a decimal multiplier (e.g., 1.5x) to display at most 2 decimal places
 * @param value - The multiplier value
 * @returns Formatted string with x suffix
 */
export function formatMultiplier(value: number): string {
  return `${formatNumber(value)}x`;
}
