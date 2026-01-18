'use client';

import Link from 'next/link';
import { WorkoutTemplates } from '@/components/exercises/WorkoutTemplates';

export default function TemplatesPage() {
  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="mb-6">
        <Link
          href="/exercises"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 py-2 active:opacity-70 transition-colors"
        >
          ← Back to Exercises
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-primary bg-clip-text text-transparent">
          Workout Templates
        </h1>
        <p className="text-muted-foreground">Create and manage your workout templates</p>
      </div>
      <WorkoutTemplates />
    </div>
  );
}
