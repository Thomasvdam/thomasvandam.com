'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Dumbbell, Activity, Check, Trash2 } from 'lucide-react';
import type { Workout } from '@/lib/exerciseTypes';
import { getExerciseById } from '@/lib/exerciseStorage';
import { formatDate, isStrengthEntry } from '@/lib/exerciseUtils';

interface WorkoutCardProps {
  workout: Workout;
  onDelete?: (id: string) => void;
  onClick?: (workout: Workout) => void;
}

export function WorkoutCard({ workout, onDelete, onClick }: WorkoutCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete(workout.id);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
    <Card
      className={`border transition-all duration-200 ${
        onClick 
          ? 'cursor-pointer hover:shadow-lg hover:border-primary/50 hover:scale-[1.01] active:scale-[0.99]' 
          : 'hover:shadow-md'
      }`}
      onClick={() => onClick?.(workout)}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {formatDate(workout.date)}
          </CardTitle>
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="shadow-sm hover:shadow-md"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {workout.exercises.map((entry, index) => {
            const exercise = getExerciseById(entry.exerciseId);
            if (!exercise) return null;

            return (
              <div 
                key={`${entry.exerciseId}-${index}`} 
                className="p-4 rounded-md border bg-card hover:border-primary/30 transition-all"
              >
                <div className="font-semibold text-base mb-3 flex items-center gap-2">
                  {exercise.type === 'strength' ? (
                    <Dumbbell className="h-5 w-5 text-primary" />
                  ) : (
                    <Activity className="h-5 w-5 text-[hsl(262_83%_58%)]" />
                  )}
                  {exercise.name}
                  <Badge 
                    variant={exercise.type === 'strength' ? 'default' : 'secondary'} 
                    className={`ml-auto ${
                      exercise.type === 'strength' 
                        ? 'bg-primary' 
                        : 'bg-[hsl(262_83%_58%)] text-white border-[hsl(262_83%_58%)]'
                    }`}
                  >
                    {exercise.type === 'strength' ? 'Strength' : 'Cardio'}
                  </Badge>
                </div>
                {isStrengthEntry(entry, exercise) ? (
                  <div className="space-y-2">
                    {entry.setData && entry.setData.length > 0 ? (
                      // Show per-set data
                      <div className="space-y-2 pl-3 border-l-3 border-primary/50">
                        {entry.setData.map((set, setIndex) => (
                          <div
                            key={`${entry.exerciseId}-set-${setIndex}`}
                            className={`text-sm flex items-center gap-2 ${
                              set.completed 
                                ? 'text-foreground font-medium' 
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              set.completed 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {setIndex + 1}
                            </span>
                            Set {setIndex + 1}: {set.reps} × {set.weight}kg
                            {set.completed && <Check className="h-4 w-4 text-primary ml-1" />}
                          </div>
                        ))}
                        <div className="mt-2">
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
                            RPE {entry.rpe}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      // Display entry-level values when setData is not available
                      <div className="text-muted-foreground pl-3 border-l-3 border-primary/50">
                        {entry.sets} × {entry.reps} @ {entry.weight}kg (RPE {entry.rpe})
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground pl-3 border-l-3 border-[hsl(262_83%_58%)]/50 flex items-center gap-2">
                    <span className="font-semibold text-foreground">{entry.duration}</span> min
                    {entry.distance && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="font-semibold text-foreground">{entry.distance}</span> km
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>

    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Workout</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this workout from {formatDate(workout.date)}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
