export interface DayAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  is_active: boolean;
}

export type ActionResponse = {
  success: boolean;
  error?: string;
};