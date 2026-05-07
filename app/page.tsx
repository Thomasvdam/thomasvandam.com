import Image from "next/image";
import Link from "next/link";
import {
	ArrowRight,
	ExternalLink,
	Github,
	Mail,
	Quote,
	Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const GITHUB_URL = "https://github.com/thomasvdam";
const SEDA_URL = "https://www.seda.xyz";
const SEDA_GITHUB_URL = "https://github.com/sedaprotocol/";

const TRIPLE_URL = "https://www.wearetriple.com/en";

export default function Home() {
	return (
		<div id="top" className="min-h-screen font-(family-name:--font-geist-sans)">
			{/* Sticky nav */}
			<header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-md">
				<nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
					<a
						href="#top"
						className="text-sm font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
					>
						Thomas van Dam
					</a>
					<div className="flex items-center gap-4 sm:gap-6">
						<a
							href="#about"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
						>
							About
						</a>
						<a
							href="#work"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
						>
							Work
						</a>
						<a
							href="#accolades"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
						>
							Accolades
						</a>
						<a
							href="#tinkering"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
						>
							Tinkering
						</a>
						<Button variant="ghost" size="icon" asChild className="shrink-0">
							<a
								href={GITHUB_URL}
								target="_blank"
								rel="noopener noreferrer"
								aria-label="GitHub"
							>
								<Github className="size-5" />
							</a>
						</Button>
					</div>
				</nav>
			</header>

			<main className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
				{/* Hero */}
				<section className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
					<div className="space-y-6">
						<div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
							<Sparkles className="size-3.5" aria-hidden />
							Strong opinions, loosely held.
						</div>
						<h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
							<span className="bg-linear-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
								Thomas van Dam
							</span>
						</h1>
						<p className="text-lg text-muted-foreground sm:text-xl">
							Fool Stack engineer at{" "}
							<a
								href={SEDA_URL}
								target="_blank"
								rel="noopener noreferrer"
								className="font-medium text-primary underline-offset-4 hover:underline"
							>
								SEDA
							</a>
							. Certified smelly nerd — I build things, break things, and
							occasionally ship something useful.
						</p>
						<div className="flex flex-wrap gap-3">
							<Button asChild size="lg" className="gap-2">
								<a href="#work">
									View work
									<ArrowRight className="size-4" />
								</a>
							</Button>
							<Button variant="outline" size="lg" asChild className="gap-2">
								<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
									<Github className="size-4" />
									GitHub
								</a>
							</Button>
						</div>
					</div>
					<div className="relative mx-auto w-full max-w-sm lg:max-w-xs">
						<div className="overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-lg ring-1 ring-primary/20">
							<Image
								src="/images/catman.jpeg"
								alt="Thomas with a cat on his shoulder"
								width={500}
								height={500}
								priority
								className="aspect-square w-full rounded-lg object-cover"
							/>
						</div>
					</div>
				</section>

				<Separator className="my-16 bg-border/60" />

				{/* About */}
				<section id="about" className="scroll-mt-24 space-y-6">
					<h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
						About
					</h2>

					<blockquote className="max-w-2xl border-l-4 border-primary/40 pl-5 py-1 my-2">
						<p className="text-lg font-medium leading-relaxed text-foreground/95 italic">
							&ldquo;Sucking at something is the first step to being kind of
							good at something.&rdquo;
						</p>
						<cite className="mt-2 block text-sm font-normal not-italic text-muted-foreground">
							— Jake the Dog,{" "}
							<span className="whitespace-nowrap">Adventure Time</span>
						</cite>
					</blockquote>

					<p className="max-w-2xl text-muted-foreground leading-relaxed">
						I like arguing about code, arguing about the process of writing
						code, and arguing about the process of arguing about code. When
						I&apos;m actually building/breaking things I like code that
						communicates intent, clear error messages, and pretending I write
						both. This site is mostly a playground — if something looks
						half-baked, that&apos;s probably intentional (or I&apos;ll fix it
						eventually).
					</p>

					<div className="flex flex-wrap gap-2">
						{[
							"TypeScript",
							"Effect-TS",
							"React",
							"WebAssembly",
							"Video Streaming",
						].map((tech) => (
							<Badge key={tech} variant="secondary">
								{tech}
							</Badge>
						))}
					</div>
				</section>

				<Separator className="my-16 bg-border/60" />

				{/* Work */}
				<section id="work" className="scroll-mt-24 space-y-8">
					<div>
						<h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
							Work
						</h2>
						<p className="mt-2 text-muted-foreground">
							Where I&apos;ve been paid to pretend I know what I&apos;m doing.
						</p>
					</div>
					<div className="space-y-4">
						<Card className="border-primary/20">
							<CardHeader>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div>
										<CardTitle className="text-xl">
											<a
												href={SEDA_URL}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
											>
												SEDA
												<ExternalLink className="size-4 opacity-70" />
											</a>
										</CardTitle>
										<CardDescription className="mt-1">
											Fool Stack Engineer — 2023-present
										</CardDescription>
									</div>
									<Badge variant="outline">Current</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground leading-relaxed">
									Building infrastructure for data in Web3. See{" "}
									<a
										href={SEDA_GITHUB_URL}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
									>
										SEDA on GitHub
										<ExternalLink className="size-4 opacity-70" />
									</a>{" "}
									for some of the code.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div>
										<CardTitle className="text-xl">
											<a
												href={TRIPLE_URL}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
											>
												Triple (now part of Hypersolid)
												<ExternalLink className="size-4 opacity-70" />
											</a>
										</CardTitle>
										<CardDescription className="mt-1">
											Software Engineer — 2015-2023
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									Building JavaScript web apps, hybrid mobile apps, Chromecast
									apps, and web video streaming. Transitioned from frontend to
									backend, from just engineering to jointly managing the team.
								</p>
							</CardContent>
						</Card>
					</div>
				</section>

				<Separator className="my-16 bg-border/60" />

				{/* Accolades — satirical “reviews” */}
				<section id="accolades" className="scroll-mt-24 space-y-8">
					<div>
						<h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
							Accolades
						</h2>
						<p className="mt-2 text-muted-foreground">
							Hand-picked praise from people who may or may not exist. Ratings
							are fictional; the industry subtext is not.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<Card className="relative overflow-hidden md:col-span-2">
							<div className="absolute right-4 top-4 text-primary/20">
								<Quote className="size-14" aria-hidden />
							</div>
							<CardHeader className="relative pb-2">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="secondary">★★★★★</Badge>
									<Badge variant="outline">Culture fit</Badge>
								</div>
								<CardTitle className="text-lg pt-2 font-normal leading-relaxed text-foreground">
									&ldquo;White, male, and privileged. Ideal IT worker.&rdquo;
								</CardTitle>
							</CardHeader>
							<CardContent className="relative pt-0">
								<p className="text-sm text-muted-foreground">
									— The default hiring pipeline, probably
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<div className="flex items-center gap-2">
									<Quote
										className="size-5 shrink-0 text-primary/70"
										aria-hidden
									/>
									<Badge variant="outline">PR review bully</Badge>
								</div>
								<CardTitle className="text-base font-normal leading-relaxed pt-1">
									&ldquo;He&apos;ll argue about the code, then argue about how we
									argue about code — and the error messages actually get better.
									Weird flex, but it works.&rdquo;
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								<p className="text-sm text-muted-foreground">
									— Whoever drew the short straw on review that week
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<div className="flex items-center gap-2">
									<Quote
										className="size-5 shrink-0 text-primary/70"
										aria-hidden
									/>
									<Badge variant="outline">Staff++ vibes</Badge>
								</div>
								<CardTitle className="text-base font-normal leading-relaxed pt-1">
									&ldquo;He explained the same thing three ways. I still don&apos;t
									get it, but I respect the hustle.&rdquo;
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0">
								<p className="text-sm text-muted-foreground">
									— A patient coworker
								</p>
							</CardContent>
						</Card>
					</div>
				</section>

				<Separator className="my-16 bg-border/60" />

				{/* Tinkering */}
				<section id="tinkering" className="scroll-mt-24 space-y-8">
					<div>
						<h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
							Tinkering
						</h2>
						<p className="mt-2 text-muted-foreground">
							Small experiments you can click through when you&apos;re bored.
						</p>
					</div>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						<Card className="flex flex-col">
							<div className="relative aspect-video w-full border-b border-border/70 bg-muted/30">
								<Image
									src="/images/polar-bears.png"
									alt=""
									fill
									className="object-cover object-top"
									sizes="(max-width: 640px) 100vw, 33vw"
								/>
							</div>
							<CardHeader>
								<CardTitle className="text-lg">
									Ice Holes and Polar Bears
								</CardTitle>
								<CardDescription>
									A riddle / game thing I like to annoy people with. WIP, mean
									in a loving way.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								<Badge variant="outline">Riddle</Badge>
								<Badge variant="outline">WIP</Badge>
							</CardContent>
							<CardFooter className="mt-auto pt-2">
								<Button
									asChild
									variant="default"
									className="w-full gap-2 sm:w-auto"
								>
									<Link href="/polar-bears">
										Open
										<ArrowRight className="size-4" />
									</Link>
								</Button>
							</CardFooter>
						</Card>

						<Card className="flex flex-col overflow-hidden">
							<div className="relative aspect-video w-full border-b border-border/70 bg-muted/30">
								<Image
									src="/images/you-got-this.png"
									alt=""
									fill
									className="object-cover object-top"
									sizes="(max-width: 640px) 100vw, 33vw"
								/>
							</div>
							<CardHeader>
								<CardTitle className="text-lg">You Got This</CardTitle>
								<CardDescription>
									Motivation on demand. For when the compiler is meaner than
									your inner critic.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								<Badge variant="outline">Vibes</Badge>
							</CardContent>
							<CardFooter className="mt-auto pt-2">
								<Button
									asChild
									variant="default"
									className="w-full gap-2 sm:w-auto"
								>
									<Link href="/you-got-this">
										Open
										<ArrowRight className="size-4" />
									</Link>
								</Button>
							</CardFooter>
						</Card>

						<Card className="flex flex-col sm:col-span-2 lg:col-span-1">
							<div className="relative aspect-video w-full border-b border-border/70 bg-muted/30">
								<Image
									src="/images/exercise-tracker.png"
									alt=""
									fill
									className="object-cover object-top"
									sizes="(max-width: 640px) 100vw, 33vw"
								/>
							</div>
							<CardHeader>
								<CardTitle className="text-lg">Exercise Tracker</CardTitle>
								<CardDescription>
									Local-only workout log that an LLM and I argued into
									existence. No accounts, no cloud — just you and your gains.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								<Badge variant="outline">Next.js</Badge>
								<Badge variant="outline">Local storage</Badge>
							</CardContent>
							<CardFooter className="mt-auto pt-2">
								<Button
									asChild
									variant="default"
									className="w-full gap-2 sm:w-auto"
								>
									<Link href="/exercises">
										Open
										<ArrowRight className="size-4" />
									</Link>
								</Button>
							</CardFooter>
						</Card>
					</div>
				</section>
			</main>

			{/* Footer */}
			<footer className="border-t border-border/40 bg-card/30">
				<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
					<div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
						>
							<Github className="size-4" />
							GitHub
						</a>
						<span className="hidden text-border sm:inline">|</span>
						<a
							href="mailto:hello@thomasvandam.com"
							className="inline-flex items-center gap-2 hover:text-foreground transition-colors"
						>
							<Mail className="size-4" />
							hello@thomasvandam.com
						</a>
						<span className="text-xs text-muted-foreground/80">
							(TODO: confirm email)
						</span>
					</div>
					<p className="text-xs text-muted-foreground">
						© {new Date().getFullYear()} Thomas van Dam
					</p>
				</div>
			</footer>
		</div>
	);
}
