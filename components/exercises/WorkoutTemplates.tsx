"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { TemplateBuilder } from "./TemplateBuilder";
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import type { WorkoutTemplate } from "@/lib/exerciseTypes";
import {
	getTemplates,
	saveTemplate,
	deleteTemplate,
	getTemplateById,
	getExerciseById,
} from "@/lib/exerciseStorage";
import { generateId } from "@/lib/exerciseUtils";

export function WorkoutTemplates() {
	const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [showBuilder, setShowBuilder] = useState(false);
	const [templateName, setTemplateName] = useState("");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

	const loadTemplates = useCallback(() => {
		// Use a small delay to avoid synchronous setState in effect
		setTimeout(() => {
			setTemplates(getTemplates());
		}, 0);
	}, []);

	useEffect(() => {
		loadTemplates();
	}, [loadTemplates]);

	const handleSaveTemplate = (
		exerciseIds: string[],
		exerciseSets: Record<string, number>,
	) => {
		if (!templateName.trim()) {
			// Use a simple alert for validation - could be replaced with toast later
			alert("Please enter a template name");
			return;
		}

		const template: WorkoutTemplate = {
			id: editingId || generateId(),
			name: templateName.trim(),
			exerciseIds,
			exerciseSets:
				Object.keys(exerciseSets).length > 0 ? exerciseSets : undefined,
			lastUsedValues: editingId
				? getTemplateById(editingId)?.lastUsedValues
				: undefined,
		};

		saveTemplate(template);
		loadTemplates();
		setEditingId(null);
		setShowBuilder(false);
		setTemplateName("");
	};

	const handleEdit = (id: string) => {
		const template = getTemplateById(id);
		if (template) {
			setEditingId(id);
			setTemplateName(template.name);
			setShowBuilder(true);
		}
	};

	const handleDeleteClick = (id: string) => {
		setTemplateToDelete(id);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = () => {
		if (templateToDelete) {
			deleteTemplate(templateToDelete);
			loadTemplates();
			setDeleteDialogOpen(false);
			setTemplateToDelete(null);
		}
	};

	const handleCreateNew = () => {
		setEditingId(null);
		setTemplateName("");
		setShowBuilder(true);
	};

	const handleCancel = () => {
		setShowBuilder(false);
		setEditingId(null);
		setTemplateName("");
	};

	return (
		<>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<FileText className="h-6 w-6 text-primary" />
						<h2 className="text-2xl font-bold">Workout Templates</h2>
					</div>
				</div>
				{!showBuilder && (
					<Button onClick={handleCreateNew}>
						<Plus className="h-4 w-4 mr-2" />
						Create Template
					</Button>
				)}

				{showBuilder && (
					<Card>
						<CardHeader>
							<CardTitle>
								{editingId ? "Edit Template" : "Create Template"}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="templateName">Template Name</Label>
								<Input
									id="templateName"
									type="text"
									value={templateName}
									onChange={(e) => setTemplateName(e.target.value)}
									placeholder="e.g., Push Day, Leg Day"
									className="border-2 text-base sm:text-sm"
									required
								/>
							</div>
							<TemplateBuilder
								initialExerciseIds={
									editingId ? getTemplateById(editingId)?.exerciseIds : []
								}
								initialExerciseSets={
									editingId ? getTemplateById(editingId)?.exerciseSets : {}
								}
								onSave={handleSaveTemplate}
								onCancel={handleCancel}
							/>
						</CardContent>
					</Card>
				)}

				{!showBuilder &&
					(templates.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground border border-dashed rounded-md bg-muted/30">
							<FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
							<p className="font-medium">No templates yet.</p>
							<p className="text-sm mt-1">Create your first template!</p>
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							{templates.map((template) => (
								<Card
									key={template.id}
									className="border hover:shadow-lg transition-all hover:border-primary/50"
								>
									<CardHeader>
										<CardTitle className="text-lg flex items-center justify-between">
											{template.name}
											<Badge
												variant="secondary"
												className="bg-[hsl(142_76%_36%)] text-white border-[hsl(142_76%_36%)]"
											>
												{template.exerciseIds.length} exercises
											</Badge>
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-2 mb-4">
											{template.exerciseIds.length === 0 ? (
												<div className="text-sm text-muted-foreground">
													No exercises
												</div>
											) : (
												template.exerciseIds.map((exerciseId, index) => {
													const exercise = getExerciseById(exerciseId);
													if (!exercise) return null;
													const sets = template.exerciseSets?.[exerciseId];
													return (
														<div
															key={exerciseId}
															className="text-sm flex items-center gap-2"
														>
															<Badge
																variant="outline"
																className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs"
															>
																{index + 1}
															</Badge>
															{exercise.name}
															{exercise.type === "strength" && sets && (
																<Badge
																	variant="secondary"
																	className="ml-auto text-xs bg-[hsl(27_87%_67%)] text-white border-[hsl(27_87%_67%)]"
																>
																	{sets} sets
																</Badge>
															)}
														</div>
													);
												})
											)}
										</div>
										<Separator className="my-4" />
										<div className="flex gap-2 flex-wrap">
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleEdit(template.id)}
												className="border-2"
											>
												<Edit className="h-4 w-4 mr-1" />
												Edit
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={() => handleDeleteClick(template.id)}
											>
												<Trash2 className="h-4 w-4 mr-1" />
												Delete
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					))}
			</div>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Template</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this template? This action cannot
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
