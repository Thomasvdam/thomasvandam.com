'use client';

import { useState, useEffect } from 'react';
import type { Exercise, ExerciseType } from '@/lib/exerciseTypes';
import { getExercises, saveExercise } from '@/lib/exerciseStorage';
import { generateId } from '@/lib/exerciseUtils';

interface ExerciseSelectorProps {
  value?: string;
  onChange: (exerciseId: string) => void;
  type?: ExerciseType;
  className?: string;
}

export function ExerciseSelector({
  value,
  onChange,
  type,
  className,
}: ExerciseSelectorProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseType, setNewExerciseType] = useState<ExerciseType>('strength');
  const [newExerciseIsDumbbell, setNewExerciseIsDumbbell] = useState(false);

  useEffect(() => {
    const allExercises = getExercises();
    const filtered = type
      ? allExercises.filter((e) => e.type === type)
      : allExercises;
    // Use a small delay to avoid synchronous setState in effect
    const timer = setTimeout(() => {
      setExercises(filtered);
    }, 0);
    return () => clearTimeout(timer);
  }, [type]);

  const handleAddExercise = () => {
    if (newExerciseName.trim()) {
      const newExercise: Exercise = {
        id: generateId(),
        name: newExerciseName.trim(),
        type: newExerciseType,
        isDumbbell: newExerciseType === 'strength' ? newExerciseIsDumbbell : undefined,
      };
      saveExercise(newExercise);
      setExercises(getExercises().filter((e) => (type ? e.type === type : true)));
      onChange(newExercise.id);
      setNewExerciseName('');
      setNewExerciseIsDumbbell(false);
      setShowNewExercise(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 sm:py-2 text-base sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Select exercise...</option>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>
        {!showNewExercise && (
          <button
            type="button"
            onClick={() => setShowNewExercise(true)}
            className="rounded-md border border-input bg-background px-3 py-2.5 sm:py-2 text-base sm:text-sm hover:bg-accent touch-manipulation whitespace-nowrap"
          >
            + New
          </button>
        )}
      </div>
      {showNewExercise && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newExerciseName}
              onChange={(e) => setNewExerciseName(e.target.value)}
              placeholder="Exercise name"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-base sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddExercise();
                } else if (e.key === 'Escape') {
                  setShowNewExercise(false);
                }
              }}
              autoFocus
            />
            <select
              value={newExerciseType}
              onChange={(e) => {
                setNewExerciseType(e.target.value as ExerciseType);
                if (e.target.value !== 'strength') {
                  setNewExerciseIsDumbbell(false);
                }
              }}
              className="rounded-md border border-input bg-background px-3 py-2.5 text-base sm:text-sm"
            >
              <option value="strength">Strength</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
          {newExerciseType === 'strength' && (
            <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newExerciseIsDumbbell}
                onChange={(e) => setNewExerciseIsDumbbell(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300"
              />
              <span className="text-sm">Dumbbell (doubles weight for volume)</span>
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddExercise}
              className="flex-1 rounded-md bg-primary px-3 py-2.5 text-base sm:text-sm text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewExercise(false);
                setNewExerciseName('');
                setNewExerciseIsDumbbell(false);
              }}
              className="rounded-md border border-input bg-background px-3 py-2.5 text-base sm:text-sm hover:bg-accent active:bg-accent/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
