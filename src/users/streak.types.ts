export interface StreakProgress {
  scoreAdded: number;
  todayScore: number;
  dailyTarget: number;
  remainingScore: number;
  progressPercent: number;
  completedToday: boolean;
  justCompleted: boolean;
  previousStreak: number;
  currentStreak: number;
}

export interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  dailyTarget: number;
  nextDailyTarget: number | null;
  targetEffectiveDate: string | null;
  todayScore: number;
  remainingScore: number;
  progressPercent: number;
  completedToday: boolean;
  lastCompletedDate: string | null;
  timezone: string;
  message: string;
}
