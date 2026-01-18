'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { StrengthEntryForm } from './StrengthEntryForm';
import { CardioEntryForm } from './CardioEntryForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, ClipboardList, Dumbbell } from 'lucide-react';
import type {
  ExerciseEntry,
  WorkoutTemplate,
  Workout,
  StrengthExerciseEntry,
  CardioExerciseEntry,
  SetData,
} from '@/lib/exerciseTypes';
import { getExerciseById } from '@/lib/exerciseStorage';

interface LogWorkoutFormProps {
  template: WorkoutTemplate;
  initialDate?: string;
  onSubmit: (workout: Omit<Workout, 'id'>) => void;
  onCancel?: () => void;
  hideDate?: boolean;
  submitButtonText?: string;
}

export function LogWorkoutForm({
  template,
  initialDate,
  onSubmit,
  onCancel,
  hideDate = false,
  submitButtonText = 'Save Workout',
}: LogWorkoutFormProps) {
  const [date, setDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Initialize entries from template using useMemo
  const initialEntries = useMemo<ExerciseEntry[]>(() => {
    if (template.exerciseIds) {
      return template.exerciseIds.map(
        (exerciseId) => {
          const exercise = getExerciseById(exerciseId);
          if (!exercise) return null;

          const history = template.lastUsedValues?.[exerciseId];

          if (exercise.type === 'strength') {
            // Priority: template exerciseSets > history sets > default 3
            const sets = template.exerciseSets?.[exerciseId] || history?.sets || 3;
            const reps = history?.reps || 10;
            const weight = history?.weight || 0;
            
            // Use exact setData from history if available, otherwise use default values
            let setData: SetData[];
            if (history?.setData && history.setData.length > 0) {
              const historySetData = history.setData;
              // Use exact setData from previous workout, padding or truncating to match current sets count
              setData = Array.from({ length: sets }, (_, index) => {
                if (index < historySetData.length) {
                  // Use exact values from previous workout
                  return {
                    weight: historySetData[index].weight,
                    reps: historySetData[index].reps,
                    completed: false,
                  };
                }
                // If more sets than previous workout, use the last set's values
                const lastSet = historySetData[historySetData.length - 1];
                return {
                  weight: lastSet.weight,
                  reps: lastSet.reps,
                  completed: false,
                };
              });
            } else {
              // Fall back to using average/default values
              setData = Array.from({ length: sets }, () => ({
                weight,
                reps,
                completed: false,
              }));
            }
            
            return {
              exerciseId,
              sets,
              reps,
              weight,
              setData,
              rpe: history?.rpe || 7,
            } as StrengthExerciseEntry;
          } else {
            return {
              exerciseId,
              duration: history?.duration || 30,
              distance: history?.distance,
            } as CardioExerciseEntry;
          }
        }
      ).filter((e): e is ExerciseEntry => e !== null);
    }
    return [];
  }, [template.exerciseIds, template.exerciseSets, template.lastUsedValues]);

  const [entries, setEntries] = useState<ExerciseEntry[]>(initialEntries);

  // Sync entries when template changes
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const handleUpdateEntry = (index: number, entry: ExerciseEntry) => {
    const newEntries = [...entries];
    const oldEntry = newEntries[index];
    newEntries[index] = entry;
    setEntries(newEntries);

    // Check if exercise should be collapsed (all sets completed for strength, or duration set for cardio)
    const exercise = getExerciseById(entry.exerciseId);
    if (exercise?.type === 'strength' && 'setData' in entry) {
      const strengthEntry = entry as StrengthExerciseEntry;
      const allSetsCompleted = strengthEntry.setData?.every(set => set.completed) ?? false;
      const wasAllCompleted = 'setData' in oldEntry 
        ? (oldEntry as StrengthExerciseEntry).setData?.every(set => set.completed) ?? false
        : false;

      if (allSetsCompleted && !wasAllCompleted) {
        // Collapse exercise when all sets are completed
        setCollapsedExercises((prev) => new Set([...prev, index]));
        
        // Scroll to next exercise after a short delay
        setTimeout(() => {
          const nextExerciseIndex = index + 1;
          if (nextExerciseIndex < newEntries.length && exerciseRefs.current[nextExerciseIndex]) {
            exerciseRefs.current[nextExerciseIndex]?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }
        }, 100);
      } else if (!allSetsCompleted && wasAllCompleted) {
        // Expand exercise if sets are uncompleted
        setCollapsedExercises((prev) => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
      }
    } else if (exercise?.type === 'cardio' && 'duration' in entry) {
      const cardioEntry = entry as CardioExerciseEntry;
      const isCompleted = cardioEntry.duration > 0;
      const wasCompleted = 'duration' in oldEntry 
        ? (oldEntry as CardioExerciseEntry).duration > 0
        : false;

      if (isCompleted && !wasCompleted) {
        // Collapse cardio exercise when duration is set
        setCollapsedExercises((prev) => new Set([...prev, index]));
        
        // Scroll to next exercise after a short delay
        setTimeout(() => {
          const nextExerciseIndex = index + 1;
          if (nextExerciseIndex < newEntries.length && exerciseRefs.current[nextExerciseIndex]) {
            exerciseRefs.current[nextExerciseIndex]?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }
        }, 100);
      } else if (!isCompleted && wasCompleted) {
        // Expand exercise if duration is cleared
        setCollapsedExercises((prev) => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
      }
    }
  };

  const toggleExerciseCollapse = (index: number) => {
    setCollapsedExercises((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const isExerciseCompleted = (entry: ExerciseEntry): boolean => {
    const exercise = getExerciseById(entry.exerciseId);
    if (exercise?.type === 'strength' && 'setData' in entry) {
      const strengthEntry = entry as StrengthExerciseEntry;
      return strengthEntry.setData?.every(set => set.completed) ?? false;
    } else if (exercise?.type === 'cardio' && 'duration' in entry) {
      const cardioEntry = entry as CardioExerciseEntry;
      return cardioEntry.duration > 0;
    }
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entries.length === 0) {
      alert('Please add at least one exercise');
      return;
    }
    onSubmit({
      date,
      exercises: entries,
      templateId: template.id,
    });
  };

  const getLastUsedText = (exerciseId: string): string | null => {
    if (!template.lastUsedValues?.[exerciseId]) return null;
    const history = template.lastUsedValues[exerciseId];
    const exercise = getExerciseById(exerciseId);

    if (exercise?.type === 'strength' && history.sets) {
      const dumbbellText = exercise.isDumbbell ? ' (DB)' : '';
      return `Last used: ${history.sets}×${history.reps} @ ${history.weight}kg${dumbbellText} (RPE ${history.rpe})`;
    } else if (exercise?.type === 'cardio' && history.duration) {
      return `Last used: ${history.duration} min${
        history.distance ? `, ${history.distance} km` : ''
      }`;
    }
    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {!hideDate && (
        <div className="space-y-2">
          <Label htmlFor='date' className="text-base font-semibold">Date</Label>
          <Input
            id='date'
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 text-base border border-border/70 shadow-sm hover:shadow-md transition-all"
            required
          />
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <ClipboardList className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Using template:</span>
        <Badge variant="outline" className="border-primary/30 text-primary">{template.name}</Badge>
      </div>

      {entries.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-6 w-6 text-primary" />
            <h2 className="font-semibold text-xl">Exercises</h2>
            <Badge variant="secondary" className="ml-auto bg-[hsl(142_76%_36%)] text-white border-[hsl(142_76%_36%)]">{entries.length}</Badge>
          </div>
          {entries.map((entry, index) => {
            const exercise = getExerciseById(entry.exerciseId);
            if (!exercise) return null;

            const lastUsedText = getLastUsedText(entry.exerciseId);
            const isCollapsed = collapsedExercises.has(index);
            const isCompleted = isExerciseCompleted(entry);

            // Get summary text for collapsed state
            const getSummaryText = (): string => {
              if (exercise.type === 'strength' && 'setData' in entry) {
                const strengthEntry = entry as StrengthExerciseEntry;
                const completedSets = strengthEntry.setData?.filter(s => s.completed).length ?? 0;
                const totalSets = strengthEntry.sets ?? 0;
                if (completedSets > 0) {
                  const avgWeight = strengthEntry.setData
                    ?.filter(s => s.completed)
                    .reduce((sum, s) => sum + s.weight, 0) ?? 0;
                  const avgReps = strengthEntry.setData
                    ?.filter(s => s.completed)
                    .reduce((sum, s) => sum + s.reps, 0) ?? 0;
                  const completedCount = strengthEntry.setData?.filter(s => s.completed).length ?? 0;
                  return `${completedSets}/${totalSets} sets completed • Avg: ${(avgWeight / completedCount).toFixed(1)}kg × ${Math.round(avgReps / completedCount)} reps • RPE ${strengthEntry.rpe}`;
                }
                return `${totalSets} sets planned`;
              } else if (exercise.type === 'cardio' && 'duration' in entry) {
                const cardioEntry = entry as CardioExerciseEntry;
                return `${cardioEntry.duration} min${cardioEntry.distance ? ` • ${cardioEntry.distance} km` : ''}`;
              }
              return '';
            };

            return (
              <div
                key={`${entry.exerciseId}-${index}`}
                ref={(el) => {
                  exerciseRefs.current[index] = el;
                }}
                className={`rounded-md border border-border/70 space-y-4 bg-card hover:shadow-lg transition-all duration-200 hover:border-primary/40 hover:scale-[1.01] ${
                  isCollapsed ? 'p-5' : 'p-6'
                } ${isCompleted ? 'border-primary/30' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <button
                    type="button"
                    onClick={() => toggleExerciseCollapse(index)}
                    className="flex-1 text-left group"
                  >
                    <div className="font-semibold text-xl text-foreground mb-2 flex items-center gap-2">
                      {exercise.name}
                      <Badge 
                        variant={exercise.type === 'strength' ? 'default' : 'secondary'} 
                        className={`ml-1 ${
                          exercise.type === 'strength' 
                            ? 'bg-primary' 
                            : 'bg-[hsl(262_83%_58%)] text-white border-[hsl(262_83%_58%)]'
                        }`}
                      >
                        {exercise.type === 'strength' ? 'Strength' : 'Cardio'}
                      </Badge>
                      {isCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors ml-auto" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors ml-auto" />
                      )}
                    </div>
                    {lastUsedText && !isCollapsed && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {lastUsedText}
                      </Badge>
                    )}
                    {isCollapsed && (
                      <div className="text-sm text-muted-foreground mt-2">
                        {getSummaryText()}
                      </div>
                    )}
                  </button>
                </div>
                {!isCollapsed && (
                  <>
                    {exercise.type === 'strength' && 'sets' in entry && (
                      <StrengthEntryForm
                        value={entry as StrengthExerciseEntry}
                        onChange={(updatedEntry) =>
                          handleUpdateEntry(index, updatedEntry)
                        }
                      />
                    )}
                    {exercise.type === 'cardio' && 'duration' in entry && (
                      <CardioEntryForm
                        value={entry as CardioExerciseEntry}
                        onChange={(updatedEntry) =>
                          handleUpdateEntry(index, updatedEntry)
                        }
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-md bg-muted/30">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium">No exercises in template.</p>
          <p className="text-sm mt-1">Please edit the template to add exercises.</p>
        </div>
      )}

      <Separator className="my-6" />
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          type="submit" 
          className="w-full sm:w-auto text-base h-11 bg-primary hover:opacity-90 shadow-md hover:shadow-lg transition-all"
        >
          {submitButtonText}
        </Button>
        {onCancel && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            className="w-full sm:w-auto text-base h-11 hover:bg-accent border-2"
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
