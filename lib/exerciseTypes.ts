export type ExerciseType = 'strength' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  isDumbbell?: boolean; // For strength exercises: if true, weight is doubled for volume calculations
}

export interface SetData {
  weight: number; // in kg or lbs
  reps: number;
  completed: boolean;
}

export interface StrengthExerciseEntry {
  exerciseId: string;
  sets: number; // number of sets
  reps: number; // default reps per set (used if setData is not provided)
  weight: number; // default weight per set (used if setData is not provided)
  setData?: SetData[]; // per-set data - if provided, overrides default weight/reps
  rpe: number; // Rate of Perceived Exertion (1-10)
}

export interface CardioExerciseEntry {
  exerciseId: string;
  duration: number; // in minutes
  distance?: number; // optional, in km or miles
}

export type ExerciseEntry = StrengthExerciseEntry | CardioExerciseEntry;

export interface Workout {
  id: string;
  date: string; // ISO date string
  exercises: ExerciseEntry[];
  templateId?: string; // Track which template was used
}

export interface TemplateExerciseHistory {
  exerciseId: string;
  // For strength exercises
  sets?: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  setData?: SetData[]; // Store exact per-set data from previous workout
  // For cardio exercises
  duration?: number;
  distance?: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exerciseIds: string[]; // Just exercise IDs, no sets/reps/weight
  exerciseSets?: Record<string, number>; // exerciseId -> number of sets (for strength exercises)
  lastUsedValues?: Record<string, TemplateExerciseHistory>; // exerciseId -> last values
}
