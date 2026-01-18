'use client';

import Link from 'next/link';
import { WorkoutHistory } from '@/components/exercises/WorkoutHistory';
import { ArrowLeft } from 'lucide-react';

export default function HistoryPage() {
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/exercises"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 py-2 active:opacity-70 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exercises
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-primary bg-clip-text text-transparent">
          Workout History
        </h1>
        <p className="text-muted-foreground">View and manage your past workouts</p>
      </div>
      <WorkoutHistory />
    </div>
  );
}
