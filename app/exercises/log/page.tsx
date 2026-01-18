'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogWorkoutForm } from '@/components/exercises/LogWorkoutForm';
import { TemplateConfirmation } from '@/components/exercises/TemplateConfirmation';
import {
  saveWorkout,
  getTemplateById,
  updateTemplateHistory,
} from '@/lib/exerciseStorage';
import { generateId } from '@/lib/exerciseUtils';
import type { Workout } from '@/lib/exerciseTypes';
import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function LogWorkoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('template');
  const [template, setTemplate] = useState<ReturnType<typeof getTemplateById>>(
    () => templateId ? getTemplateById(templateId) : undefined
  );
  const [showConfirmation, setShowConfirmation] = useState(true);

  useEffect(() => {
    if (templateId) {
      const foundTemplate = getTemplateById(templateId);
      // If no template found, redirect back
      if (!foundTemplate) {
        router.push('/exercises');
        return;
      }
      // Use a small delay to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setTemplate(foundTemplate);
      }, 0);
      return () => clearTimeout(timer);
    } else {
      // If no template ID, redirect to exercises page
      router.push('/exercises');
    }
  }, [templateId, router]);

  const handleConfirm = () => {
    setShowConfirmation(false);
  };

  const handleCancel = () => {
    router.push('/exercises?showPicker=true');
  };

  const handleSubmit = (workoutData: Omit<Workout, 'id'>) => {
    const workout: Workout = {
      ...workoutData,
      id: generateId(),
    };
    saveWorkout(workout);

    // Update template history if this workout was created from a template
    if (workout.templateId) {
      updateTemplateHistory(workout.templateId, workout);
    }

    router.push('/exercises/history');
  };

  if (!template) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto max-w-4xl py-4 sm:py-8 px-4">
      <div className="mb-4 sm:mb-6">
        <Link
          href="/exercises"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 py-2 active:opacity-70 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Exercises
        </Link>
      </div>
      {showConfirmation ? (
        <TemplateConfirmation
          template={template}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : (
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
              <FileText className="h-7 w-7 text-primary" />
              Log Workout
            </h1>
            <p className="text-muted-foreground">Record your workout details</p>
          </div>
          <LogWorkoutForm
            template={template}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/exercises?showPicker=true')}
          />
        </div>
      )}
    </div>
  );
}

export default function LogWorkoutPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto max-w-4xl py-4 sm:py-8 px-4">
        <div className="mb-4 sm:mb-6">
          <Link
            href="/exercises"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 py-2 active:opacity-70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Exercises
          </Link>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    }>
      <LogWorkoutPageContent />
    </Suspense>
  );
}
