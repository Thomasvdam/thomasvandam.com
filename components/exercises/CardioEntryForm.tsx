'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CardioExerciseEntry } from '@/lib/exerciseTypes';

interface CardioEntryFormProps {
  value?: CardioExerciseEntry;
  onChange: (entry: CardioExerciseEntry) => void;
  onRemove?: () => void;
}

export function CardioEntryForm({
  value,
  onChange,
  onRemove,
}: CardioEntryFormProps) {
  const [entry, setEntry] = useState<CardioExerciseEntry>(
    () => value || {
      exerciseId: '',
      duration: 30,
      distance: undefined,
    }
  );

  useEffect(() => {
    if (value) {
      // Use a small delay to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setEntry(value);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const updateEntry = (updates: Partial<CardioExerciseEntry>) => {
    const newEntry = { ...entry, ...updates };
    setEntry(newEntry);
    onChange(newEntry);
  };

  const adjustDuration = (delta: number) => {
    const newDuration = Math.max(1, entry.duration + delta);
    updateEntry({ duration: newDuration });
  };

  const adjustDistance = (delta: number) => {
    const currentDistance = entry.distance || 0;
    const newDistance = Math.max(0, currentDistance + delta);
    updateEntry({ distance: newDistance > 0 ? newDistance : undefined });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-card rounded-md p-5 border border-border/70">
          <Label className="text-sm font-semibold block mb-3 text-center">Duration (min)</Label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustDuration(-1)}
              className="flex-shrink-0 w-14 h-14 rounded-md border border-transparent bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation hover:border-primary/30 shadow-sm hover:shadow-md"
              aria-label="Decrease duration by 1 minute"
            >
              −
            </button>
            <Input
              type="number"
              min="1"
              value={entry.duration}
              onChange={(e) =>
                updateEntry({ duration: parseInt(e.target.value) || 0 })
              }
              className="flex-1 h-14 text-2xl font-bold text-center border shadow-sm hover:shadow-md"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => adjustDuration(1)}
              className="flex-shrink-0 w-14 h-14 rounded-md border border-transparent bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation hover:border-primary/30 shadow-sm hover:shadow-md"
              aria-label="Increase duration by 1 minute"
            >
              +
            </button>
          </div>
        </div>
        <div className="bg-card rounded-md p-5 border border-border/70">
          <Label className="text-sm font-semibold block mb-3 text-center">Distance (km)</Label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustDistance(-0.1)}
              className="flex-shrink-0 w-14 h-14 rounded-md border border-transparent bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation hover:border-primary/30 shadow-sm hover:shadow-md"
              aria-label="Decrease distance by 0.1km"
            >
              −
            </button>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={entry.distance ?? ''}
              onChange={(e) =>
                updateEntry({
                  distance: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              placeholder="Optional"
              className="flex-1 h-14 text-2xl font-bold text-center border shadow-sm hover:shadow-md"
              inputMode="decimal"
            />
            <button
              type="button"
              onClick={() => adjustDistance(0.1)}
              className="flex-shrink-0 w-14 h-14 rounded-md border border-transparent bg-muted hover:bg-muted/80 active:bg-muted/60 flex items-center justify-center text-2xl font-bold transition-all touch-manipulation hover:border-primary/30 shadow-sm hover:shadow-md"
              aria-label="Increase distance by 0.1km"
            >
              +
            </button>
          </div>
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
