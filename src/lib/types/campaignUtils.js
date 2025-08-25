// Phase 1: Hybrid Linear Campaign Functions
// Utility functions for the two-tier AI system

/**
 * Calculate chapter from round number
 * Chapters are 20-25 rounds each with varying boundaries
 */
export function calculateChapter(round) {
  if (round <= 25) return 1;
  if (round <= 50) return 2;
  if (round <= 75) return 3;
  if (round <= 100) return 4;
  if (round <= 125) return 5;
  if (round <= 150) return 6;
  if (round <= 175) return 7;
  if (round <= 200) return 8;
  return Math.ceil(round / 25); // fallback for campaigns > 200 rounds
}

/**
 * Check if current round is a chapter boundary
 */
export function isChapterBoundary(round) {
  const boundaries = [25, 50, 75, 100, 125, 150, 175, 200];
  return boundaries.includes(round);
}

/**
 * Check if campaign is complete
 */
export function isCampaignComplete(round, targetRounds = 200) {
  return round >= targetRounds;
}

/**
 * Calculate campaign progress percentage
 */
export function calculateProgress(round, targetRounds = 200) {
  return Math.min(100, Math.round((round / targetRounds) * 100));
}

/**
 * Calculate D&D ability modifier from score
 */
export function getAbilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * Get proficiency bonus by level
 */
export function getProficiencyBonus(level) {
  return Math.ceil(level / 4) + 1;
}

/**
 * Format round display with chapter info
 */
export function formatRoundDisplay(round, targetRounds = 200) {
  const chapter = calculateChapter(round);
  const progress = calculateProgress(round, targetRounds);
  return `Round ${round} (Chapter ${chapter}) - ${progress}%`;
}

/**
 * Get next chapter boundary
 */
export function getNextChapterBoundary(round) {
  const boundaries = [25, 50, 75, 100, 125, 150, 175, 200];
  return boundaries.find((boundary) => boundary > round) || round + 25;
}

/**
 * Check if milestone summary should be triggered (every 25 rounds)
 */
export function shouldTriggerSummary(round) {
  return round % 25 === 0;
}
