'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getExerciseById } from '@/lib/exerciseStorage';
import type { WorkoutTemplate } from '@/lib/exerciseTypes';
import { CheckCircle2, Dumbbell, Activity } from 'lucide-react';

interface TemplateConfirmationProps {
  template: WorkoutTemplate;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TemplateConfirmation({
  template,
  onConfirm,
  onCancel,
}: TemplateConfirmationProps) {
  const exercises = template.exerciseIds
    .map((id) => getExerciseById(id))
    .filter((e): e is NonNullable<typeof e> => e !== undefined);

  return (
    <Card className="border shadow-lg">
      <CardHeader className="bg-card border-b border-border/70">
        <CardTitle className="text-2xl flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          Confirm Template: <Badge variant="outline" className="ml-1 border-primary/30 text-primary text-base">{template.name}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div>
          <p className="text-sm text-muted-foreground mb-5 font-medium">
            This template contains <span className="font-bold text-foreground">{exercises.length}</span> exercise{exercises.length !== 1 ? 's' : ''}. 
            Review the exercises below and confirm to start your workout.
          </p>
          <div className="space-y-3 border rounded-md p-5 bg-card">
            {exercises.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                No exercises in this template
              </div>
            ) : (
              exercises.map((exercise) => {
                const lastUsed = template.lastUsedValues?.[exercise.id];
                const hasLastUsed = lastUsed && (
                  (exercise.type === 'strength' && lastUsed.sets) ||
                  (exercise.type === 'cardio' && lastUsed.duration)
                );

                return (
                  <div key={exercise.id} className="flex flex-col gap-2 p-4 rounded-md bg-card border hover:border-primary/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        {exercise.type === 'strength' ? (
                          <Dumbbell className="h-4 w-4 text-primary" />
                        ) : (
                          <Activity className="h-4 w-4 text-[hsl(262_83%_58%)]" />
                        )}
                        <span className="font-semibold text-base">{exercise.name}</span>
                      </div>
                      <Badge 
                        variant={exercise.type === 'strength' ? 'default' : 'secondary'} 
                        className={`capitalize ${
                          exercise.type === 'strength' 
                            ? 'bg-primary' 
                            : 'bg-[hsl(262_83%_58%)] text-white border-[hsl(262_83%_58%)]'
                        }`}
                      >
                        {exercise.type}
                      </Badge>
                    </div>
                    {hasLastUsed && (
                      <Badge variant="outline" className="text-xs w-fit">
                        {exercise.type === 'strength' && lastUsed.sets ? (
                          <>
                            Last used: {lastUsed.sets}×{lastUsed.reps || '?'} @ {lastUsed.weight || 0}kg
                            {exercise.isDumbbell && ' (DB)'}
                            {lastUsed.rpe && ` (RPE ${lastUsed.rpe})`}
                          </>
                        ) : exercise.type === 'cardio' && lastUsed.duration ? (
                          <>
                            Last used: {lastUsed.duration} min
                            {lastUsed.distance && `, ${lastUsed.distance} km`}
                          </>
                        ) : null}
                      </Badge>
                    )}
                    {!hasLastUsed && (
                      <Badge variant="outline" className="text-xs w-fit italic">
                        No previous values
                      </Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex gap-3">
          <Button 
            onClick={onConfirm} 
            className="flex-1 h-11 bg-primary hover:opacity-90 shadow-md hover:shadow-lg transition-all"
          >
            Confirm & Start Workout
          </Button>
          <Button 
            onClick={onCancel} 
            variant="outline" 
            className="flex-1 h-11 border hover:bg-accent"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
