'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TemplatePicker } from '@/components/exercises/TemplatePicker';
import { getWorkouts } from '@/lib/exerciseStorage';
import { formatDate } from '@/lib/exerciseUtils';
import type { Workout } from '@/lib/exerciseTypes';
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Dumbbell, Calendar, Trophy, Settings, Play, History, BarChart3, ArrowRight } from 'lucide-react';

function ExercisesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [showTemplatePicker, setShowTemplatePicker] = useState(
    searchParams.get('showPicker') === 'true'
  );

  useEffect(() => {
    const workouts = getWorkouts();
    const sorted = workouts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setRecentWorkouts(sorted.slice(0, 5));

    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const thisWeek = workouts.filter((workout) => {
      const workoutDate = new Date(workout.date);
      return isWithinInterval(workoutDate, { start: weekStart, end: weekEnd });
    });
    setThisWeekCount(thisWeek.length);
  }, []);

  useEffect(() => {
    // Update state when URL changes
    setShowTemplatePicker(searchParams.get('showPicker') === 'true');
  }, [searchParams]);

  const handleSelectTemplate = (templateId: string) => {
    router.push(`/exercises/log?template=${templateId}`);
  };

  const handleBackFromPicker = () => {
    setShowTemplatePicker(false);
    router.push('/exercises');
  };

  if (showTemplatePicker) {
    return (
      <div className="container mx-auto max-w-6xl py-4 sm:py-8 px-4">
        <div className="mb-4 sm:mb-6">
          <Button
            variant="ghost"
            onClick={handleBackFromPicker}
            className="text-sm text-muted-foreground hover:text-foreground active:opacity-70"
          >
            ← Back
          </Button>
        </div>
        <TemplatePicker onSelectTemplate={handleSelectTemplate} />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-4 sm:py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-5xl font-bold mb-2 bg-primary bg-clip-text text-transparent">
          Exercise Tracker
        </h1>
        <p className="text-muted-foreground text-lg">Track your fitness journey</p>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
        <Card className="border hover:shadow-lg transition-all duration-200 hover:border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              onClick={() => router.push('/exercises?showPicker=true')} 
              className="w-full text-base h-11 bg-primary hover:opacity-90 shadow-md"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Workout
            </Button>
            <Button asChild variant="outline" className="w-full text-base h-11 hover:bg-accent border-2">
              <Link href="/exercises/history">
                <History className="h-4 w-4 mr-2" />
                View History
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-primary/20 hover:shadow-lg transition-all duration-200 bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              This Week
            </CardTitle>
            <CardDescription>Workouts logged</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{thisWeekCount}</div>
          </CardContent>
        </Card>

        <Card className="border border-[hsl(262_83%_58%)]/20 hover:shadow-lg transition-all duration-200 bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[hsl(262_83%_58%)]" />
              Total Workouts
            </CardTitle>
            <CardDescription>All time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[hsl(262_83%_58%)]">{recentWorkouts.length > 0 ? getWorkouts().length : 0}</div>
          </CardContent>
        </Card>

        <Card className="border hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Navigation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full text-base h-11 hover:bg-accent border-2">
              <Link href="/exercises/templates">Templates</Link>
            </Button>
            <Button asChild variant="outline" className="w-full text-base h-11 hover:bg-accent border-2">
              <Link href="/exercises/stats">
                <BarChart3 className="h-4 w-4 mr-2" />
                Statistics
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 mb-6">
        <Card className="border hover:shadow-lg transition-all duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Recent Workouts
            </CardTitle>
            <CardDescription>Your latest activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentWorkouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-md">
                <Dumbbell className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                <p>No workouts yet. Start logging your workouts!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="flex items-center justify-between py-3 px-4 rounded-md border hover:border-primary/50 hover:bg-accent/50 transition-all duration-200 group"
                  >
                    <div>
                      <div className="font-semibold text-base">{formatDate(workout.date)}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs bg-[hsl(142_76%_36%)] text-white border-[hsl(142_76%_36%)]">
                          {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="group-hover:text-primary">
                      <Link href="/exercises/history">
                        View
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto max-w-6xl py-4 sm:py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-5xl font-bold mb-2 bg-primary bg-clip-text text-transparent">
            Exercise Tracker
          </h1>
          <p className="text-muted-foreground text-lg">Track your fitness journey</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    }>
      <ExercisesPageContent />
    </Suspense>
  );
}
