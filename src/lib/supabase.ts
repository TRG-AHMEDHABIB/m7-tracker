import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});

// ---- Types ----
export type TaskType = 'SETUP' | 'VIDEO' | 'PRACTICE' | 'MEMORIZE' | 'VOCAB' | 'REVIEW' | 'TEST' | 'REST';
export type Section = 'Quant' | 'Verbal';
export type Phase = 'Foundation' | 'Strategy' | 'Practice' | 'Execution' | 'Test Week';

export interface Task {
  id: string;
  task_date: string;
  week_label: string;
  day_label: string | null;
  icon: string | null;
  task_text: string;
  minutes: number;
  task_type: TaskType;
  sort_order: number;
  done: boolean;
  done_at: string | null;
  actual_minutes: number | null;
  notes: string | null;
  original_date: string | null;
  rescheduled_count: number;
}

export interface ErrorEntry {
  id: string;
  logged_at: string;
  question_date: string;
  week_label: string | null;
  section: Section;
  question_type: string;
  topic: string | null;
  difficulty: string | null;
  source: string;
  source_ref: string | null;
  what_i_did_wrong: string;
  fix_lesson: string;
  time_spent_seconds: number | null;
  reattempted: boolean;
  reattempted_at: string | null;
  reattempt_correct: boolean | null;
  tags: string[];
  is_repeat_pattern: boolean;
}

export interface WeeklyGoal {
  week_label: string;
  dates_label: string;
  focus: string;
  phase: Phase;
  hours_target: number;
  quant_q_target: number;
  verbal_q_target: number;
  vocab_target: number;
  notes: string;
  reflection: string | null;
}
