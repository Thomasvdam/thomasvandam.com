"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getTemplates, getExerciseById } from "@/lib/exerciseStorage";
import type { WorkoutTemplate } from "@/lib/exerciseTypes";
import { FileText, Plus, Play } from "lucide-react";
import Link from "next/link";

interface TemplatePickerProps {
	onSelectTemplate: (templateId: string) => void;
}

export function TemplatePicker({ onSelectTemplate }: TemplatePickerProps) {
	const [templates] = useState<WorkoutTemplate[]>(getTemplates());

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-bold flex items-center gap-2">
						<FileText className="h-6 w-6 text-primary" />
						Select a Template
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Choose a template to start your workout
					</p>
				</div>
			</div>
			<Button asChild variant="outline" className="border-2">
				<Link href="/exercises/templates">
					<Plus className="h-4 w-4 mr-2" />
					Create New Template
				</Link>
			</Button>

			{templates.length === 0 ? (
				<Card className="border border-dashed">
					<CardContent className="py-12 text-center">
						<FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
						<p className="text-muted-foreground mb-4 font-medium">
							No templates yet. Create your first template to get started!
						</p>
						<Button asChild>
							<Link href="/exercises/templates">
								<Plus className="h-4 w-4 mr-2" />
								Create Template
							</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{templates.map((template) => {
						const previewExercises = template.exerciseIds
							.slice(0, 3)
							.map((id) => getExerciseById(id))
							.filter((e): e is NonNullable<typeof e> => e !== undefined);

						const remainingCount =
							template.exerciseIds.length - previewExercises.length;

						return (
							<Card
								key={template.id}
								className="cursor-pointer hover:border-primary transition-all border hover:shadow-lg"
								onClick={() => onSelectTemplate(template.id)}
							>
								<CardHeader>
									<CardTitle className="text-lg flex items-center justify-between">
										{template.name}
										<Badge
											variant="secondary"
											className="bg-[hsl(142_76%_36%)] text-white border-[hsl(142_76%_36%)]"
										>
											{template.exerciseIds.length}
										</Badge>
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-2 mb-4">
										{previewExercises.length === 0 ? (
											<div className="text-sm text-muted-foreground">
												No exercises
											</div>
										) : (
											<>
												{previewExercises.map((exercise, index) => (
													<div
														key={exercise.id}
														className="text-sm text-muted-foreground flex items-center gap-2"
													>
														<Badge
															variant="outline"
															className="w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs"
														>
															{index + 1}
														</Badge>
														{exercise.name}
													</div>
												))}
												{remainingCount > 0 && (
													<Badge variant="secondary" className="text-xs mt-2">
														+{remainingCount} more exercise
														{remainingCount !== 1 ? "s" : ""}
													</Badge>
												)}
											</>
										)}
									</div>
									<Separator className="my-4" />
									<Button
										className="w-full"
										onClick={() => onSelectTemplate(template.id)}
									>
										<Play className="h-4 w-4 mr-2" />
										Use Template
									</Button>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
