import type {
  Exercise,
  Workout,
  WorkoutTemplate,
  TemplateExerciseHistory,
  SetData,
} from './exerciseTypes';

const STORAGE_KEYS = {
  EXERCISES: 'exercises',
  WORKOUTS: 'workouts',
  TEMPLATES: 'templates',
} as const;

// Default exercises to initialize with
const DEFAULT_EXERCISES: Exercise[] = [
  // Strength exercises
  { id: '1', name: 'Bench Press', type: 'strength' },
  { id: '2', name: 'Squat', type: 'strength' },
  { id: '3', name: 'Deadlift', type: 'strength' },
  { id: '4', name: 'Overhead Press', type: 'strength' },
  { id: '5', name: 'Barbell Row', type: 'strength' },
  { id: '6', name: 'Pull-ups', type: 'strength' },
  { id: '7', name: 'Dips', type: 'strength' },
  { id: '8', name: 'Bicep Curls', type: 'strength' },
  { id: '9', name: 'Tricep Extensions', type: 'strength' },
  // Cardio exercises
  { id: '11', name: 'Running', type: 'cardio' },
];

function initializeStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(stored) as T;
  } catch (error) {
    console.error(`Error initializing storage for ${key}:`, error);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to storage for ${key}:`, error);
    throw error;
  }
}

// Exercise functions
export function getExercises(): Exercise[] {
  return initializeStorage(STORAGE_KEYS.EXERCISES, DEFAULT_EXERCISES);
}

export function saveExercise(exercise: Exercise): void {
  const exercises = getExercises();
  const index = exercises.findIndex((e) => e.id === exercise.id);
  
  if (index >= 0) {
    exercises[index] = exercise;
  } else {
    exercises.push(exercise);
  }
  
  saveToStorage(STORAGE_KEYS.EXERCISES, exercises);
}

export function deleteExercise(id: string): void {
  const exercises = getExercises();
  const filtered = exercises.filter((e) => e.id !== id);
  saveToStorage(STORAGE_KEYS.EXERCISES, filtered);
}

export function getExerciseById(id: string): Exercise | undefined {
  return getExercises().find((e) => e.id === id);
}

// Workout functions
export function getWorkouts(): Workout[] {
  return initializeStorage(STORAGE_KEYS.WORKOUTS, []);
}

export function saveWorkout(workout: Workout): void {
  const workouts = getWorkouts();
  const index = workouts.findIndex((w) => w.id === workout.id);
  
  if (index >= 0) {
    workouts[index] = workout;
  } else {
    workouts.push(workout);
  }
  
  saveToStorage(STORAGE_KEYS.WORKOUTS, workouts);
}

export function deleteWorkout(id: string): void {
  const workouts = getWorkouts();
  const filtered = workouts.filter((w) => w.id !== id);
  saveToStorage(STORAGE_KEYS.WORKOUTS, filtered);
}

export function getWorkoutById(id: string): Workout | undefined {
  return getWorkouts().find((w) => w.id === id);
}

// Template functions
export function getTemplates(): WorkoutTemplate[] {
  return initializeStorage<WorkoutTemplate[]>(
    STORAGE_KEYS.TEMPLATES,
    []
  );
}

export function saveTemplate(template: WorkoutTemplate): void {
  const templates = getTemplates();
  const index = templates.findIndex((t) => t.id === template.id);
  
  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.push(template);
  }
  
  saveToStorage(STORAGE_KEYS.TEMPLATES, templates);
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  saveToStorage(STORAGE_KEYS.TEMPLATES, filtered);
}

export function getTemplateById(id: string): WorkoutTemplate | undefined {
  return getTemplates().find((t) => t.id === id);
}

// Update template history when a workout is saved
export function updateTemplateHistory(templateId: string, workout: Workout): void {
  const template = getTemplateById(templateId);
  if (!template) {
    console.warn(`Template ${templateId} not found for history update`);
    return;
  }

  const lastUsedValues: Record<string, TemplateExerciseHistory> = {
    ...(template.lastUsedValues || {}),
  };

  // Update history for each exercise in the workout
  workout.exercises.forEach((entry) => {
    const exercise = getExerciseById(entry.exerciseId);
    if (!exercise) return;

    if (exercise.type === 'strength' && 'sets' in entry) {
      // Store exact setData from completed sets, or use default values
      let reps = entry.reps;
      let weight = entry.weight;
      let setData: SetData[] | undefined;
      
      if (entry.setData && entry.setData.length > 0) {
        const completedSets = entry.setData.filter(set => set.completed);
        if (completedSets.length > 0) {
          // Store the exact setData from completed sets
          setData = completedSets.map(set => ({
            weight: set.weight,
            reps: set.reps,
            completed: false, // Reset completed status for prefilling
          }));
          // Store average reps and weight from completed sets
          const totalReps = completedSets.reduce((sum, set) => sum + set.reps, 0);
          const totalWeight = completedSets.reduce((sum, set) => sum + set.weight, 0);
          reps = Math.round(totalReps / completedSets.length);
          weight = totalWeight / completedSets.length;
        }
      }
      
      lastUsedValues[entry.exerciseId] = {
        exerciseId: entry.exerciseId,
        sets: entry.sets,
        reps,
        weight,
        rpe: entry.rpe,
        setData,
      };
    } else if (exercise.type === 'cardio' && 'duration' in entry) {
      lastUsedValues[entry.exerciseId] = {
        exerciseId: entry.exerciseId,
        duration: entry.duration,
        distance: entry.distance,
      };
    }
  });

  // Update template with new history
  const updatedTemplate: WorkoutTemplate = {
    ...template,
    lastUsedValues,
  };

  saveTemplate(updatedTemplate);
}
