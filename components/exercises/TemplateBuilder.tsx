'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExerciseSelector } from './ExerciseSelector';
import { getExerciseById } from '@/lib/exerciseStorage';
import { GripVertical, X, Dumbbell, Activity } from 'lucide-react';

interface TemplateBuilderProps {
  initialExerciseIds?: string[];
  initialExerciseSets?: Record<string, number>;
  onSave: (exerciseIds: string[], exerciseSets: Record<string, number>) => void;
  onCancel: () => void;
}

function SortableExerciseItem({
  exerciseId,
  sets,
  onSetsChange,
  onRemove,
}: {
  exerciseId: string;
  sets?: number;
  onSetsChange: (sets: number) => void;
  onRemove: () => void;
}) {
  const exercise = getExerciseById(exerciseId);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exerciseId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!exercise) return null;

  const isStrengthExercise = exercise.type === 'strength';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border bg-card p-4 hover:border-primary/30 transition-all shadow-sm"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0 p-1 touch-manipulation"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 font-medium flex items-center gap-2 min-w-0">
          {isStrengthExercise ? (
            <Dumbbell className="h-4 w-4 text-primary flex-shrink-0" />
          ) : (
            <Activity className="h-4 w-4 text-[hsl(262_83%_58%)] flex-shrink-0" />
          )}
          <span className="truncate">{exercise.name}</span>
          <Badge 
            variant={isStrengthExercise ? 'default' : 'secondary'} 
            className={`ml-auto text-xs flex-shrink-0 ${
              isStrengthExercise 
                ? 'bg-primary' 
                : 'bg-[hsl(262_83%_58%)] text-white border-[hsl(262_83%_58%)]'
            }`}
          >
            {exercise.type}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {isStrengthExercise && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Sets:</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={sets ?? 3}
              onChange={(e) => onSetsChange(parseInt(e.target.value) || 3)}
              className="w-20 h-9 text-sm text-center border-2"
            />
          </div>
        )}
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors p-2 rounded hover:bg-destructive/10 touch-manipulation flex-shrink-0"
          aria-label="Remove exercise"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TemplateBuilder({
  initialExerciseIds = [],
  initialExerciseSets = {},
  onSave,
  onCancel,
}: TemplateBuilderProps) {
  const [exerciseIds, setExerciseIds] = useState<string[]>(initialExerciseIds);
  const [exerciseSets, setExerciseSets] = useState<Record<string, number>>(
    initialExerciseSets
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setExerciseIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddExercise = () => {
    if (selectedExerciseId && !exerciseIds.includes(selectedExerciseId)) {
      setExerciseIds([...exerciseIds, selectedExerciseId]);
      const exercise = getExerciseById(selectedExerciseId);
      // Set default sets to 3 for strength exercises
      if (exercise?.type === 'strength') {
        setExerciseSets({ ...exerciseSets, [selectedExerciseId]: 3 });
      }
      setSelectedExerciseId('');
    }
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setExerciseIds(exerciseIds.filter((id) => id !== exerciseId));
    const newSets = { ...exerciseSets };
    delete newSets[exerciseId];
    setExerciseSets(newSets);
  };

  const handleSetsChange = (exerciseId: string, sets: number) => {
    setExerciseSets({ ...exerciseSets, [exerciseId]: sets });
  };

  const handleSave = () => {
    if (exerciseIds.length === 0) {
      alert('Please add at least one exercise to the template');
      return;
    }
    onSave(exerciseIds, exerciseSets);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Add Exercise</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <ExerciseSelector
              value={selectedExerciseId}
              onChange={setSelectedExerciseId}
            />
          </div>
          <Button
            type="button"
            onClick={handleAddExercise}
            disabled={!selectedExerciseId || exerciseIds.includes(selectedExerciseId)}
            className="w-full sm:w-auto"
          >
            Add
          </Button>
        </div>
      </div>

      {exerciseIds.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>
              Exercises ({exerciseIds.length})
            </Label>
            <Badge variant="secondary">{exerciseIds.length} total</Badge>
          </div>
          <Separator />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={exerciseIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {exerciseIds.map((exerciseId) => (
                  <SortableExerciseItem
                    key={exerciseId}
                    exerciseId={exerciseId}
                    sets={exerciseSets[exerciseId]}
                    onSetsChange={(sets) => handleSetsChange(exerciseId, sets)}
                    onRemove={() => handleRemoveExercise(exerciseId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Drag exercises to reorder them
          </p>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-md bg-muted/30">
          <Dumbbell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium">No exercises added yet.</p>
          <p className="text-sm mt-1">Add exercises above to build your template.</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-4">
        <Button onClick={handleSave} disabled={exerciseIds.length === 0} className="w-full sm:w-auto">
          Save Template
        </Button>
        <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
    </div>
  );
}
