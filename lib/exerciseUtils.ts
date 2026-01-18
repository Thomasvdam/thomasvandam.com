import type {
  Exercise,
  ExerciseEntry,
  StrengthExerciseEntry,
  Workout,
} from './exerciseTypes';

export function isStrengthEntry(
  entry: ExerciseEntry,
  exercise?: Exercise
): entry is StrengthExerciseEntry {
  if (exercise) {
    return exercise.type === 'strength';
  }
  return 'sets' in entry && 'reps' in entry && 'weight' in entry && 'rpe' in entry;
}

export function calculateVolume(entry: StrengthExerciseEntry, exercise?: Exercise): number {
  const isDumbbell = exercise?.isDumbbell || false;
  
  // Calculate volume from individual sets
  if (entry.setData && entry.setData.length > 0) {
    return entry.setData.reduce((total, set) => {
      if (!set.completed) return total;
      const effectiveWeight = isDumbbell ? set.weight * 2 : set.weight;
      return total + set.reps * effectiveWeight;
    }, 0);
  }
  
  // If no setData, calculate from entry-level values
  const effectiveWeight = isDumbbell ? entry.weight * 2 : entry.weight;
  return entry.sets * entry.reps * effectiveWeight;
}

export function calculateTotalVolume(workout: Workout, exercises: Exercise[]): number {
  return workout.exercises.reduce((total, entry) => {
    const exercise = exercises.find((e) => e.id === entry.exerciseId);
    if (exercise && isStrengthEntry(entry, exercise)) {
      return total + calculateVolume(entry, exercise);
    }
    return total;
  }, 0);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
