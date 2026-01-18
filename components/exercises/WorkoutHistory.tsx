"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkoutCard } from "./WorkoutCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { BarChart3 } from "lucide-react";
import type { Workout } from "@/lib/exerciseTypes";
import {
	getWorkouts,
	deleteWorkout,
	getExerciseById,
} from "@/lib/exerciseStorage";
import { Label } from "@/components/ui/label";

interface WorkoutHistoryProps {
	onWorkoutClick?: (workout: Workout) => void;
}

export function WorkoutHistory({ onWorkoutClick }: WorkoutHistoryProps) {
	const [workouts, setWorkouts] = useState<Workout[]>([]);
	const [filterType, setFilterType] = useState<"all" | "strength" | "cardio">(
		"all",
	);
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);

	const loadWorkouts = useCallback(() => {
		const allWorkouts = getWorkouts();
		// Use a small delay to avoid synchronous setState in effect
		setTimeout(() => {
			setWorkouts(allWorkouts);
		}, 0);
	}, []);

	useEffect(() => {
		loadWorkouts();
	}, [loadWorkouts]);

	const handleDeleteClick = (id: string) => {
		setWorkoutToDelete(id);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = () => {
		if (workoutToDelete) {
			deleteWorkout(workoutToDelete);
			loadWorkouts();
			setDeleteDialogOpen(false);
			setWorkoutToDelete(null);
		}
	};

	const filteredWorkouts = workouts
		.filter((workout) => {
			if (startDate && workout.date < startDate) return false;
			if (endDate && workout.date > endDate) return false;
			if (filterType === "all") return true;

			return workout.exercises.some((entry) => {
				const exercise = getExerciseById(entry.exerciseId);
				if (!exercise) return false;

				if (filterType === "strength") {
					return exercise.type === "strength";
				}
				if (filterType === "cardio") {
					return exercise.type === "cardio";
				}
				return true;
			});
		})
		.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	return (
		<>
			<div className="space-y-5">
				<div className="flex flex-wrap gap-4 p-5 rounded-md border bg-card shadow-sm">
					<div className="flex gap-2">
						<Button
							variant={filterType === "all" ? "default" : "outline"}
							size="sm"
							onClick={() => setFilterType("all")}
							className={
								filterType === "all" ? "bg-primary shadow-md" : "border-2"
							}
						>
							All
						</Button>
						<Button
							variant={filterType === "strength" ? "default" : "outline"}
							size="sm"
							onClick={() => setFilterType("strength")}
							className={
								filterType === "strength" ? "bg-primary shadow-md" : "border-2"
							}
						>
							Strength
						</Button>
						<Button
							variant={filterType === "cardio" ? "default" : "outline"}
							size="sm"
							onClick={() => setFilterType("cardio")}
							className={
								filterType === "cardio"
									? "bg-[hsl(262_83%_58%)] shadow-md"
									: "border-2"
							}
						>
							Cardio
						</Button>
					</div>
					<div className="flex gap-2 flex-col">
						<div className="flex gap-2 items-center">
							<Label htmlFor="startDate" className="w-10 text-sm font-medium">Start</Label>
							<Input
								type="date"
								value={startDate}
								onChange={(e) => setStartDate(e.target.value)}
								placeholder="Start date"
								className="h-10 border shadow-sm hover:shadow-md"
							/>
						</div>
						<div className="flex gap-2 items-center">
							<Label htmlFor="endDate" className="w-10 text-sm font-medium">End</Label>
							<Input
								type="date"
								value={endDate}
								onChange={(e) => setEndDate(e.target.value)}
								placeholder="End date"
								className="h-10 border shadow-sm hover:shadow-md"
							/>
						</div>
						{(startDate || endDate) && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setStartDate("");
									setEndDate("");
								}}
								className="border hover:bg-accent"
							>
								Clear
							</Button>
						)}
					</div>
				</div>

				{filteredWorkouts.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground border border-dashed rounded-md bg-muted/30">
						<BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
						<p className="font-medium">No workouts found.</p>
						<p className="text-sm mt-1">Start logging your workouts!</p>
					</div>
				) : (
					<div className="space-y-4">
						{filteredWorkouts.map((workout) => (
							<WorkoutCard
								key={workout.id}
								workout={workout}
								onDelete={handleDeleteClick}
								onClick={onWorkoutClick}
							/>
						))}
					</div>
				)}
			</div>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Workout</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this workout? This action cannot
							be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogOpen(false)}
						>
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
