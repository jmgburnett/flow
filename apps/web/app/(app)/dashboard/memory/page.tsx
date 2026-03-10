"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Brain,
	Plus,
	Search,
	Pin,
	PinOff,
	Trash2,
	X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "personal" | "project" | "meeting" | "idea" | "other";

interface Memory {
	_id: Id<"memories">;
	userId: string;
	title: string;
	content: string;
	category: Category;
	tags?: string[];
	pinned: boolean;
	source: "manual" | "ai" | "email" | "recording";
	sourceId?: string;
	createdAt: number;
	updatedAt: number;
}

const CATEGORIES: { value: Category | "all"; label: string; color: string }[] = [
	{ value: "all", label: "All", color: "bg-slate-600" },
	{ value: "personal", label: "Personal", color: "bg-blue-600" },
	{ value: "project", label: "Project", color: "bg-green-600" },
	{ value: "meeting", label: "Meeting", color: "bg-purple-600" },
	{ value: "idea", label: "Idea", color: "bg-yellow-600" },
	{ value: "other", label: "Other", color: "bg-slate-500" },
];

function getCategoryColor(category: Category): string {
	return CATEGORIES.find((c) => c.value === category)?.color ?? "bg-slate-500";
}

function timeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days === 1) return "Yesterday";
	if (days < 7) return `${days}d ago`;
	return new Date(timestamp).toLocaleDateString();
}

export default function MemoryPage() {
	const user = {
		name: "Josh",
		email: "josh@onflourish.com",
		image: undefined as string | undefined,
	};

	// TODO: Replace with real user ID from auth
	const userId = "user_josh";

	const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	// Form state
	const [formTitle, setFormTitle] = useState("");
	const [formContent, setFormContent] = useState("");
	const [formCategory, setFormCategory] = useState<Category>("personal");
	const [formTags, setFormTags] = useState("");
	const [formPinned, setFormPinned] = useState(false);

	const memories = useQuery(api.memories.list, {
		userId,
		category: selectedCategory === "all" ? undefined : selectedCategory,
	});

	const createMemory = useMutation(api.memories.create);
	const updateMemory = useMutation(api.memories.update);
	const removeMemory = useMutation(api.memories.remove);
	const togglePin = useMutation(api.memories.togglePin);

	// Filter by search
	const filteredMemories = memories?.filter((m) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return (
			m.title.toLowerCase().includes(q) ||
			m.content.toLowerCase().includes(q) ||
			m.tags?.some((t) => t.toLowerCase().includes(q))
		);
	});

	function openCreate() {
		setFormTitle("");
		setFormContent("");
		setFormCategory("personal");
		setFormTags("");
		setFormPinned(false);
		setIsCreating(true);
		setEditingMemory(null);
	}

	function openEdit(memory: Memory) {
		setFormTitle(memory.title);
		setFormContent(memory.content);
		setFormCategory(memory.category);
		setFormTags(memory.tags?.join(", ") ?? "");
		setFormPinned(memory.pinned);
		setEditingMemory(memory);
		setIsCreating(false);
		setShowDeleteConfirm(false);
	}

	function closeDialog() {
		setEditingMemory(null);
		setIsCreating(false);
		setShowDeleteConfirm(false);
	}

	async function handleSave() {
		const tags = formTags
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);

		if (isCreating) {
			await createMemory({
				userId,
				title: formTitle || "Untitled",
				content: formContent,
				category: formCategory,
				tags,
				pinned: formPinned,
			});
		} else if (editingMemory) {
			await updateMemory({
				id: editingMemory._id,
				title: formTitle || "Untitled",
				content: formContent,
				category: formCategory,
				tags,
				pinned: formPinned,
			});
		}
		closeDialog();
	}

	async function handleDelete() {
		if (editingMemory) {
			await removeMemory({ id: editingMemory._id });
			closeDialog();
		}
	}

	async function handleTogglePin(e: React.MouseEvent, id: Id<"memories">) {
		e.stopPropagation();
		await togglePin({ id });
	}

	const isDialogOpen = isCreating || editingMemory !== null;

	return (
		<DashboardLayout user={user}>
			<div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Brain className="h-6 w-6 text-blue-400" />
						<h1 className="text-xl font-bold">Memory</h1>
					</div>
					<Button size="sm" onClick={openCreate} className="gap-1">
						<Plus className="h-4 w-4" />
						New
					</Button>
				</div>

				{/* Search */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search memories..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Category filters */}
				<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
					{CATEGORIES.map((cat) => (
						<button
							key={cat.value}
							type="button"
							onClick={() => setSelectedCategory(cat.value)}
							className={cn(
								"px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
								selectedCategory === cat.value
									? "bg-blue-600 text-white"
									: "bg-muted text-muted-foreground hover:bg-muted/80",
							)}
						>
							{cat.label}
						</button>
					))}
				</div>

				{/* Memory list */}
				<div className="space-y-3">
					{!filteredMemories ? (
						// Loading skeleton
						Array.from({ length: 3 }).map((_, i) => (
							<Card key={`skeleton-${i}`} className="animate-pulse">
								<CardContent className="p-4">
									<div className="h-4 bg-muted rounded w-1/3 mb-2" />
									<div className="h-3 bg-muted rounded w-full mb-1" />
									<div className="h-3 bg-muted rounded w-2/3" />
								</CardContent>
							</Card>
						))
					) : filteredMemories.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
							<p className="font-medium">No memories yet</p>
							<p className="text-sm mt-1">
								Tap the + button to create your first memory
							</p>
						</div>
					) : (
						filteredMemories.map((memory) => (
							<Card
								key={memory._id}
								className="cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
								onClick={() => openEdit(memory as Memory)}
							>
								<CardContent className="p-4">
									<div className="flex items-start justify-between gap-2">
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<h3 className="font-semibold text-sm truncate">
													{memory.title}
												</h3>
												{memory.pinned && (
													<Pin className="h-3 w-3 text-blue-400 shrink-0 fill-blue-400" />
												)}
											</div>
											<p className="text-xs text-muted-foreground line-clamp-2 mb-2">
												{memory.content}
											</p>
											<div className="flex items-center gap-2 flex-wrap">
												<Badge
													variant="secondary"
													className={cn(
														"text-[10px] text-white",
														getCategoryColor(memory.category),
													)}
												>
													{memory.category}
												</Badge>
												{memory.tags?.slice(0, 3).map((tag) => (
													<Badge
														key={tag}
														variant="outline"
														className="text-[10px]"
													>
														{tag}
													</Badge>
												))}
												{(memory.tags?.length ?? 0) > 3 && (
													<span className="text-[10px] text-muted-foreground">
														+{(memory.tags?.length ?? 0) - 3}
													</span>
												)}
												<span className="text-[10px] text-muted-foreground ml-auto">
													{timeAgo(memory.updatedAt)}
												</span>
											</div>
										</div>
										<button
											type="button"
											onClick={(e) => handleTogglePin(e, memory._id)}
											className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
										>
											{memory.pinned ? (
												<PinOff className="h-4 w-4 text-blue-400" />
											) : (
												<Pin className="h-4 w-4 text-muted-foreground" />
											)}
										</button>
									</div>
								</CardContent>
							</Card>
						))
					)}
				</div>
			</div>

			{/* Create / Edit Dialog */}
			<Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
				<DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Brain className="h-5 w-5 text-blue-400" />
							{isCreating ? "New Memory" : "Edit Memory"}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div>
							<label className="text-sm font-medium mb-1.5 block">Title</label>
							<Input
								placeholder="What's this about?"
								value={formTitle}
								onChange={(e) => setFormTitle(e.target.value)}
								autoFocus
							/>
						</div>

						<div>
							<label className="text-sm font-medium mb-1.5 block">Content</label>
							<Textarea
								placeholder="Write your notes here..."
								value={formContent}
								onChange={(e) => setFormContent(e.target.value)}
								rows={6}
								className="resize-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="text-sm font-medium mb-1.5 block">
									Category
								</label>
								<Select
									value={formCategory}
									onValueChange={(v) => setFormCategory(v as Category)}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="personal">Personal</SelectItem>
										<SelectItem value="project">Project</SelectItem>
										<SelectItem value="meeting">Meeting</SelectItem>
										<SelectItem value="idea">Idea</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-end">
								<Button
									type="button"
									variant={formPinned ? "default" : "outline"}
									size="sm"
									className="gap-1.5 w-full"
									onClick={() => setFormPinned(!formPinned)}
								>
									<Pin className={cn("h-4 w-4", formPinned && "fill-current")} />
									{formPinned ? "Pinned" : "Pin it"}
								</Button>
							</div>
						</div>

						<div>
							<label className="text-sm font-medium mb-1.5 block">
								Tags{" "}
								<span className="text-muted-foreground font-normal">
									(comma-separated)
								</span>
							</label>
							<Input
								placeholder="e.g. church.tech, strategy, Q2"
								value={formTags}
								onChange={(e) => setFormTags(e.target.value)}
							/>
						</div>
					</div>

					<DialogFooter className="flex-col sm:flex-row gap-2">
						{editingMemory && !showDeleteConfirm && (
							<Button
								variant="ghost"
								size="sm"
								className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 mr-auto"
								onClick={() => setShowDeleteConfirm(true)}
							>
								<Trash2 className="h-4 w-4 mr-1" />
								Delete
							</Button>
						)}
						{showDeleteConfirm && (
							<div className="flex items-center gap-2 mr-auto">
								<span className="text-sm text-red-500">Delete?</span>
								<Button
									variant="destructive"
									size="sm"
									onClick={handleDelete}
								>
									Yes
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowDeleteConfirm(false)}
								>
									No
								</Button>
							</div>
						)}
						<div className="flex gap-2">
							<Button variant="outline" onClick={closeDialog}>
								Cancel
							</Button>
							<Button onClick={handleSave}>
								{isCreating ? "Create" : "Save"}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
