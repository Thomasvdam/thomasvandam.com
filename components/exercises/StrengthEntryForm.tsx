'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { StrengthExerciseEntry, SetData } from '@/lib/exerciseTypes';

interface StrengthEntryFormProps {
  value?: StrengthExerciseEntry;
  onChange: (entry: StrengthExerciseEntry) => void;
  onRemove?: () => void;
}

export function StrengthEntryForm({
  value,
  onChange,
  onRemove,
}: StrengthEntryFormProps) {
  const initializeEntry = (val: StrengthExerciseEntry | undefined): StrengthExerciseEntry => {
    if (!val) {
      return {
        exerciseId: '',
        sets: 3,
        reps: 10,
        weight: 0,
        rpe: 7,
      };
    }
    // Initialize setData if not present
    if (!val.setData && val.sets > 0) {
      const initialSetData: SetData[] = Array.from({ length: val.sets }, () => ({
        weight: val.weight,
        reps: val.reps,
        completed: false,
      }));
      return { ...val, setData: initialSetData };
    }
    return val;
  };

  const [entry, setEntry] = useState<StrengthExerciseEntry>(() => initializeEntry(value));
  const [collapsedSets, setCollapsedSets] = useState<Set<number>>(new Set());
  const setRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (value) {
      const initialized = initializeEntry(value);
      setEntry(initialized);
    }
  }, [value]);

  // Ensure setData is always initialized when sets change
  useEffect(() => {
    if (entry.sets > 0 && (!entry.setData || entry.setData.length !== entry.sets)) {
      const setData: SetData[] = Array.from({ length: entry.sets }, (_, index) => {
        if (entry.setData && entry.setData[index]) {
          return entry.setData[index];
        }
        return {
          weight: entry.weight,
          reps: entry.reps,
          completed: false,
        };
      });
      const newEntry = { ...entry, setData };
      setEntry(newEntry);
      onChange(newEntry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.sets]);

  const updateEntry = (updates: Partial<StrengthExerciseEntry>) => {
    const newEntry = { ...entry, ...updates };
    setEntry(newEntry);
    onChange(newEntry);
  };

  const updateSetData = (index: number, updates: Partial<SetData>) => {
    if (!entry.setData) return;
    const newSetData = [...entry.setData];
    const wasCompleted = newSetData[index]?.completed;
    newSetData[index] = { ...newSetData[index], ...updates };
    const newEntry = { ...entry, setData: newSetData };
    setEntry(newEntry);
    onChange(newEntry);

    // If set was just completed, collapse it and scroll to next set
    if (updates.completed === true && !wasCompleted) {
      setCollapsedSets((prev) => new Set([...prev, index]));
      
      // Scroll to next set after a short delay to allow DOM update
      setTimeout(() => {
        const nextSetIndex = index + 1;
        if (nextSetIndex < entry.sets && setRefs.current[nextSetIndex]) {
          setRefs.current[nextSetIndex]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);
    } else if (updates.completed === false && wasCompleted) {
      // If set was uncompleted, expand it
      setCollapsedSets((prev) => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  const toggleSetCollapse = (index: number) => {
    setCollapsedSets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const adjustWeight = (index: number, delta: number) => {
    if (!entry.setData) return;
    const currentWeight = entry.setData[index]?.weight || 0;
    const newWeight = Math.max(0, currentWeight + delta);
    updateSetData(index, { weight: newWeight });
  };

  const adjustReps = (index: number, delta: number) => {
    if (!entry.setData) return;
    const currentReps = entry.setData[index]?.reps || 0;
    const newReps = Math.max(0, currentReps + delta);
    updateSetData(index, { reps: newReps });
  };

  const adjustRPE = (delta: number) => {
    const newRPE = Math.max(1, Math.min(10, entry.rpe + delta));
    updateEntry({ rpe: newRPE });
  };


  const setData = entry.setData || [];

  return (
    <div className="space-y-4">
      {/* Sets List - Mobile First */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {entry.sets} {entry.sets === 1 ? 'Set' : 'Sets'}
          </label>
        </div>

        {/* Individual Set Inputs */}
        <div className="space-y-4">
          {setData.map((set, index) => {
            const isCollapsed = collapsedSets.has(index);
            return (
              <div
                key={index}
                ref={(el) => {
                  setRefs.current[index] = el;
                }}
                className={`rounded-md border transition-all duration-200 shadow-sm hover:shadow-md ${
                  set.completed
                    ? 'border-primary/40 bg-card'
                    : 'border-border/70 bg-card hover:border-primary/30'
                } ${isCollapsed ? 'p-4' : 'p-5'}`}
              >
                {/* Set Header with Number and Checkbox */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleSetCollapse(index)}
                    className="flex-1 text-left flex items-center gap-2 group"
                  >
                    <div className="text-base font-semibold flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all border ${
                        set.completed 
                          ? 'bg-primary text-primary-foreground border-primary/60' 
                          : 'bg-muted text-foreground/80 border-border/60'
                      }`}>
                        {index + 1}
                      </span>
                      {set.completed && (
                        <span className="text-xs font-normal text-foreground/70">
                          {set.weight}kg × {set.reps} reps
                        </span>
                      )}
                    </div>
                    {isCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors ml-auto mr-1" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors ml-auto mr-1" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSetData(index, { completed: !set.completed })}
                    className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all touch-manipulation ${
                      set.completed
                        ? 'border-[hsl(142_76%_36%)] bg-gradient-to-br from-[hsl(142_76%_36%)] to-[hsl(142_76%_45%)] text-white shadow-lg shadow-[hsl(142_76%_36%)]/30 hover:shadow-xl hover:shadow-[hsl(142_76%_36%)]/40 hover:scale-110'
                        : 'border-border/70 bg-background hover:border-[hsl(142_76%_36%)]/50 hover:bg-[hsl(142_76%_36%)]/10 hover:scale-105'
                    }`}
                    aria-label={`Mark set ${index + 1} as ${set.completed ? 'incomplete' : 'complete'}`}
                  >
                    {set.completed && (
                      <Check className="w-5 h-5 text-white font-bold" strokeWidth={3} />
                    )}
                  </button>
                </div>

                {/* Set Content - Collapsible */}
                {!isCollapsed && (
                  <div className="mt-5 space-y-5">
                    {/* Weight Input with +/- buttons */}
                    <div>
                      <Label className="block text-sm font-semibold mb-3 text-center">Weight (kg)</Label>
                      <div className="flex items-center gap-3 w-full">
                        <button
                          type="button"
                          onClick={() => adjustWeight(index, -0.5)}
                          className="flex-shrink-0 w-14 h-14 rounded-md bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation border border-transparent hover:border-primary/30 shadow-sm hover:shadow-md"
                          aria-label={`Decrease weight by 0.5kg for set ${index + 1}`}
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={set.weight || ''}
                          onChange={(e) =>
                            updateSetData(index, {
                              weight: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="flex-1 min-w-0 h-14 text-2xl font-bold text-center border shadow-sm hover:shadow-md"
                          inputMode="decimal"
                        />
                        <button
                          type="button"
                          onClick={() => adjustWeight(index, 0.5)}
                          className="flex-shrink-0 w-14 h-14 rounded-md bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation border border-transparent hover:border-primary/30 shadow-sm hover:shadow-md"
                          aria-label={`Increase weight by 0.5kg for set ${index + 1}`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Reps Input with +/- buttons */}
                    <div>
                      <Label className="block text-sm font-semibold mb-3 text-center">Reps</Label>
                      <div className="flex items-center gap-3 w-full">
                        <button
                          type="button"
                          onClick={() => adjustReps(index, -1)}
                          className="flex-shrink-0 w-14 h-14 rounded-md bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation border border-transparent hover:border-primary/30 shadow-sm hover:shadow-md"
                          aria-label={`Decrease reps by 1 for set ${index + 1}`}
                        >
                          −
                        </button>
                        <Input
                          type="number"
                          min="0"
                          value={set.reps || ''}
                          onChange={(e) =>
                            updateSetData(index, {
                              reps: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="flex-1 min-w-0 h-14 text-2xl font-bold text-center border shadow-sm hover:shadow-md"
                          inputMode="numeric"
                        />
                        <button
                          type="button"
                          onClick={() => adjustReps(index, 1)}
                          className="flex-shrink-0 w-14 h-14 rounded-md bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation border border-transparent hover:border-primary/30 shadow-sm hover:shadow-md"
                          aria-label={`Increase reps by 1 for set ${index + 1}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RPE with +/- buttons */}
      <Separator className="my-5" />
      <div className="bg-card rounded-md p-5 border border-border/70">
        <Label className="block text-sm font-semibold mb-3 text-center">
          RPE (Rate of Perceived Exertion)
        </Label>
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={() => adjustRPE(-1)}
            className="flex-shrink-0 w-14 h-14 rounded-md bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation border border-transparent hover:border-primary/30 shadow-sm hover:shadow-md"
            aria-label="Decrease RPE by 1"
          >
            −
          </button>
          <Input
            type="number"
            min="1"
            max="10"
            value={entry.rpe}
            onChange={(e) => updateEntry({ rpe: parseInt(e.target.value) || 7 })}
            className="flex-1 min-w-0 h-14 text-2xl font-bold text-center border shadow-sm hover:shadow-md"
            inputMode="numeric"
          />
          <button
            type="button"
            onClick={() => adjustRPE(1)}
            className="flex-shrink-0 w-14 h-14 rounded-md bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation border border-transparent hover:border-primary/30 shadow-sm hover:shadow-md"
            aria-label="Increase RPE by 1"
          >
            +
          </button>
        </div>
        <div className="mt-3 flex justify-center">
          <Badge 
            variant="outline" 
            className={`text-xs ${
              entry.rpe <= 3 
                ? 'border-[hsl(142_76%_36%)]/50 text-[hsl(142_76%_36%)]' 
                : entry.rpe <= 5 
                ? 'border-[hsl(142_76%_36%)]/50 text-[hsl(142_76%_36%)]' 
                : entry.rpe <= 7 
                ? 'border-[hsl(27_87%_67%)]/50 text-[hsl(27_87%_67%)]' 
                : entry.rpe <= 9 
                ? 'border-primary/50 text-primary' 
                : 'border-destructive/50 text-destructive'
            }`}
          >
            {entry.rpe <= 3 ? 'Very Easy' : entry.rpe <= 5 ? 'Easy' : entry.rpe <= 7 ? 'Moderate' : entry.rpe <= 9 ? 'Hard' : 'Very Hard'}
          </Badge>
        </div>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-destructive hover:underline w-full py-2"
        >
          Remove exercise
        </button>
      )}
    </div>
  );
}
