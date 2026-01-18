'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ExerciseSelector } from './ExerciseSelector';
import type { Workout, Exercise } from '@/lib/exerciseTypes';
import { isStrengthEntry, calculateVolume } from '@/lib/exerciseUtils';
import { formatDateShort } from '@/lib/exerciseUtils';

interface ProgressChartsProps {
  workouts: Workout[];
  exercises: Exercise[];
}

export function ProgressCharts({ workouts, exercises }: ProgressChartsProps) {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      if (startDate && workout.date < startDate) return false;
      if (endDate && workout.date > endDate) return false;
      return true;
    });
  }, [workouts, startDate, endDate]);

  const strengthData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const exercise = exercises.find((e) => e.id === selectedExerciseId);
    if (!exercise || exercise.type !== 'strength') return [];

    return filteredWorkouts
      .map((workout) => {
        const entry = workout.exercises.find(
          (e) => e.exerciseId === selectedExerciseId
        );
        if (!entry || !isStrengthEntry(entry, exercise)) return null;

        return {
          date: formatDateShort(workout.date),
          weight: entry.weight,
          volume: calculateVolume(entry, exercise),
          rpe: entry.rpe,
        };
      })
      .filter((d) => d !== null);
  }, [filteredWorkouts, selectedExerciseId, exercises]);

  const cardioData = useMemo(() => {
    const cardioExercises = exercises.filter((e) => e.type === 'cardio');
    if (cardioExercises.length === 0) return [];

    return filteredWorkouts
      .map((workout) => {
        const cardioEntries = workout.exercises.filter((entry) => {
          const exercise = exercises.find((e) => e.id === entry.exerciseId);
          return exercise?.type === 'cardio';
        });

        if (cardioEntries.length === 0) return null;

        const totalDuration = cardioEntries.reduce((sum, entry) => {
          if ('duration' in entry) {
            return sum + entry.duration;
          }
          return sum;
        }, 0);

        const totalDistance = cardioEntries.reduce((sum, entry) => {
          if ('distance' in entry && entry.distance) {
            return sum + entry.distance;
          }
          return sum;
        }, 0);

        return {
          date: formatDateShort(workout.date),
          duration: totalDuration,
          distance: totalDistance || 0,
        };
      })
      .filter((d) => d !== null);
  }, [filteredWorkouts, exercises]);

  const volumeData = useMemo(() => {
    return filteredWorkouts.map((workout) => {
      const totalVolume = workout.exercises.reduce((sum, entry) => {
        const exercise = exercises.find((e) => e.id === entry.exerciseId);
        if (exercise && isStrengthEntry(entry, exercise)) {
          return sum + calculateVolume(entry);
        }
        return sum;
      }, 0);

      return {
        date: formatDateShort(workout.date),
        volume: totalVolume,
      };
    });
  }, [filteredWorkouts, exercises]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">
            Select Exercise (for strength progress)
          </label>
          <ExerciseSelector
            value={selectedExerciseId}
            onChange={setSelectedExerciseId}
            type="strength"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {selectedExerciseId && strengthData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Strength Progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={strengthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#8884d8"
                name="Weight (kg)"
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke="#82ca9d"
                name="Volume"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {volumeData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Total Volume Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="volume" fill="#8884d8" name="Total Volume" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {cardioData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Cardio Progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cardioData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="duration"
                stroke="#8884d8"
                name="Duration (min)"
              />
              {cardioData.some((d: { distance: number }) => d.distance > 0) && (
                <Line
                  type="monotone"
                  dataKey="distance"
                  stroke="#82ca9d"
                  name="Distance (km)"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {strengthData.length === 0 &&
        volumeData.length === 0 &&
        cardioData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No data available. Start logging workouts to see your progress!
          </div>
        )}
    </div>
  );
}
