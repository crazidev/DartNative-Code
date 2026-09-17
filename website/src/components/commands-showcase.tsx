import {
	Activity,
	ArrowUpCircle,
	Bug,
	Camera,
	Check,
	Clock,
	Cpu,
	FolderPlus,
	Package,
	Play,
	RotateCcw,
	Search,
	Sparkles,
	Stethoscope,
	Terminal,
	TerminalSquare,
	Wrench,
	Zap
} from "lucide-react";
import * as React from "react";
import logo from "../assets/dartnative.png";
import { Button } from "./ui/button";

export interface CommandItem {
	id: string
	name: string
	icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
	description: string
	cliExample: string
	mockOutput: string
}

export interface TreeFamily {
	id: string
	name: string
	icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
	color: string
	glowColor: string
	bgSoft: string
	borderSoft: string
	commands: CommandItem[]
}

const TREE_FAMILIES: TreeFamily[] = [
	{
		id: "hot-reload",
		name: "Hot Reload & Debug",
		icon: Zap,
		color: "#f65c93",
		glowColor: "rgba(246, 92, 147, 0.35)",
		bgSoft: "rgba(246, 92, 147, 0.07)",
		borderSoft: "rgba(246, 92, 147, 0.45)",
		commands: [
			{
				id: "hot-reload",
				name: "Hot Reload",
				icon: Zap,
				description: "Injects code updates without losing application state.",
				cliExample: "Dart: Hot Reload",
				mockOutput: "⚡ Hot reload performed in 118ms (124 libraries reloaded)",
			},
			{
				id: "hot-restart",
				name: "Hot Restart",
				icon: RotateCcw,
				description: "Re-runs app from main() with fresh state.",
				cliExample: "Dart: Hot Restart",
				mockOutput: "🔄 Restarted application in 410ms",
			},
			{
				id: "breakpoints",
				name: "Breakpoints",
				icon: Bug,
				description: "Toggle active breakpoints and inspect call stacks.",
				cliExample: "Debug: Toggle Breakpoint",
				mockOutput: "🛑 Breakpoint active at line 42",
			},
			{
				id: "run-debug",
				name: "Run & Debug",
				icon: Play,
				description: "Launches target application with debugger attached.",
				cliExample: "Dart: Run & Debug",
				mockOutput: "🚀 Launched device: macOS Desktop (PID: 7421)",
			},
			// {
			// 	id: "rerun-session",
			// 	name: "Rerun Debug Session",
			// 	icon: RefreshCw,
			// 	description: "Terminates and restarts current debug session.",
			// 	cliExample: "Debug: Restart Session",
			// 	mockOutput: "⚡ Re-spawning active DAP debug session...",
			// },
		],
	},
	{
		id: "package-management",
		name: "Package Management",
		icon: Package,
		color: "#f1bd37",
		glowColor: "rgba(241, 189, 55, 0.35)",
		bgSoft: "rgba(241, 189, 55, 0.07)",
		borderSoft: "rgba(241, 189, 55, 0.45)",
		commands: [
			{
				id: "get-packages",
				name: "Get Packages",
				icon: Package,
				description: "Downloads and links all pubspec.yaml packages.",
				cliExample: "Dart: Get Packages",
				mockOutput: "📦 flutter pub get: Got dependencies in 1.8s",
			},
			// {
			// 	id: "add-dependency",
			// 	name: "Add Dependency",
			// 	icon: PlusCircle,
			// 	description: "Interactively search and install production packages.",
			// 	cliExample: "Dart: Add Dependency",
			// 	mockOutput: "➕ Added http: ^1.2.1 to pubspec.yaml",
			// },
			// {
			// 	id: "add-dev-dependency",
			// 	name: "Add Dev Dependency",
			// 	icon: Boxes,
			// 	description: "Install tools for testing, lints, and code generation.",
			// 	cliExample: "Dart: Add Dev Dependency",
			// 	mockOutput: "🛠️ Added mocktail to dev_dependencies",
			// },
			{
				id: "outdated-packages",
				name: "Outdated Packages",
				icon: Clock,
				description: "Check for available semver updates and breaking shifts.",
				cliExample: "Dart: Outdated Packages",
				mockOutput: "🔍 4 dependencies have newer versions available",
			},
			{
				id: "upgrade-packages",
				name: "Upgrade Packages",
				icon: ArrowUpCircle,
				description: "Upgrades dependencies according to semver bounds.",
				cliExample: "Dart: Upgrade Packages",
				mockOutput: "⬆️ Upgraded dependencies to latest compatible versions",
			},
			{
				id: "clean-project",
				name: "Clean Project",
				icon: Sparkles,
				description: "Deletes the build/ directory and cached build artifacts.",
				cliExample: "Flutter: Clean Project",
				mockOutput: "✨ Purged build cache and .dart_tool",
			},
		],
	},
	{
		id: "sdk-project",
		name: "SDK & Project",
		icon: TerminalSquare,
		color: "#6bc69a",
		glowColor: "rgba(107, 198, 154, 0.35)",
		bgSoft: "rgba(107, 198, 154, 0.07)",
		borderSoft: "rgba(107, 198, 154, 0.45)",
		commands: [
			{
				id: "run-doctor",
				name: "Run Doctor",
				icon: Stethoscope,
				description: "Runs diagnostics on toolchains, Android/iOS, and IDE.",
				cliExample: "Flutter: Run Doctor",
				mockOutput: "🩺 [✓] Flutter · [✓] Android Studio · [✓] VS Code",
			},
			{
				id: "create-project",
				name: "Create Project",
				icon: FolderPlus,
				description: "Wizard to scaffold applications, packages, or plugins.",
				cliExample: "Flutter: New Project",
				mockOutput: "🎉 Scaffolded new Flutter workspace",
			},
			{
				id: "locate-sdk",
				name: "Locate SDK",
				icon: Search,
				description: "Scans system directories and version managers for SDKs.",
				cliExample: "Dart: Locate SDK",
				mockOutput: "📍 Discovered Flutter 3.29.0 at /opt/flutter",
			},

			// {
			// 	id: "change-sdk",
			// 	name: "Change SDK",
			// 	icon: FolderSync,
			// 	description: "Quick switch active Flutter channel or Dart release.",
			// 	cliExample: "Dart: Change SDK",
			// 	mockOutput: "🔀 Switched SDK to Flutter (stable, 3.29.0)",
			// },
			{
				id: "add-sdk-to-path",
				name: "Add SDK to PATH",
				icon: Terminal,
				description: "Configures shell paths for seamless command-line use.",
				cliExample: "Dart: Add SDK to PATH",
				mockOutput: "✅ Added /opt/flutter/bin to environment PATH",
			},


			// {
			// 	id: "license-key",
			// 	name: "License Key",
			// 	icon: KeyRound,
			// 	description: "Manage team license activation and offline tokens.",
			// 	cliExample: "DartNative: Enter License Key",
			// 	mockOutput: "🔑 License active: Pro Tier (Unlimited Workspaces)",
			// },
		],
	},
	{
		id: "devtools",
		name: "DevTools",
		icon: Wrench,
		color: "#05c3f0",
		glowColor: "rgba(5, 195, 240, 0.35)",
		bgSoft: "rgba(5, 195, 240, 0.07)",
		borderSoft: "rgba(5, 195, 240, 0.45)",
		commands: [
			{
				id: "network",
				name: "Network",
				icon: Activity,
				description: "Inspect live HTTP, HTTPS, and WebSocket traffic.",
				cliExample: "Dart: Open DevTools > Network",
				mockOutput: "🌐 Network profiler active (recording HTTP requests)",
			},
			{
				id: "memory",
				name: "Memory",
				icon: Cpu,
				description: "Track heap allocations and detect memory leaks.",
				cliExample: "Dart: Open DevTools > Memory",
				mockOutput: "🧠 Heap snapshot captured (46.4 MB in use)",
			},
			// {
			// 	id: "cpu-profiler",
			// 	name: "CPU Profiler",
			// 	icon: Gauge,
			// 	description: "Profile execution time and CPU thread utilization.",
			// 	cliExample: "Dart: Open DevTools > CPU Profiler",
			// 	mockOutput: "⚡ CPU profile recorded (1,420 samples at 1000Hz)",
			// },
			{
				id: "screenshots",
				name: "Screenshots",
				icon: Camera,
				description: "Capture pixel-perfect frame of attached device.",
				cliExample: "Flutter: Screenshot Device",
				mockOutput: "📸 Screenshot saved to artifacts/device_frame.png",
			},
		],
	},
]

export function CommandsShowcase() {
	const [copiedId, setCopiedId] = React.useState<string | null>(null)

	const handleCommandClick = (cmd: CommandItem) => {
		const textToCopy = `${cmd.cliExample}`
		if (navigator.clipboard) {
			navigator.clipboard.writeText(textToCopy).catch(() => { })
		}

		setCopiedId(cmd.id)

		setTimeout(() => {
			setCopiedId((curr) => (curr === cmd.id ? null : curr))
		}, 2000)
	}

	return (
		<div className="relative w-full max-w-6xl mx-auto mt-4 px-2 sm:px-4 select-none">
			{/* ─── TREE ROOT FORK TRUNK (Longer) ─── */}
			<div className="flex flex-col items-center justify-center relative z-20">
				{/* <div className="w-[1px] h-20 bg-border/80 dark:bg-border" /> */}
				<img src={logo} alt="Dart Native Logo" className="size-28 hidden select-none drop-shadow-md" />

			</div>

			{/* ─── SVG BRANCH DISTRIBUTOR (Substantially Longer Sweeping Curves: 144px) ─── */}
			<div className="w-full h-30 relative -mt-4 hidden md:block" aria-hidden="true">
				<svg
					className="w-full h-full overflow-visible"
					viewBox="0 0 1000 144"
					preserveAspectRatio="none"
				>
					{TREE_FAMILIES.map((fam, idx) => {
						const targetX = 125 + idx * 250

						return (
							<g key={fam.id}>
								{/* Background Line Glow */}
								<path
									d={`M 500,0 C 500,72 ${targetX},72 ${targetX},144`}
									fill="none"
									stroke={fam.color}
									strokeWidth="1.5"
									strokeOpacity={0.2}
								/>

								{/* Animated Electric Current Flowing Line */}
								<path
									d={`M 500,0 C 500,72 ${targetX},72 ${targetX},144`}
									fill="none"
									stroke={fam.color}
									strokeWidth="1"
									strokeOpacity={0.85}
									strokeDasharray="4 3"
									style={{
										animation: "flowCurrent 0.75s linear infinite",
									}}
								/>

								{/* Target Joint Dot */}
								<circle
									cx={targetX}
									cy="144"
									r="2.5"
									fill={fam.color}
									style={{
										filter: `drop-shadow(0 0 3px ${fam.color})`,
									}}
								/>
							</g>
						)
					})}
				</svg>
			</div>

			{/* ─── TREE FAMILIES: 4 COLUMNS ─── */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6 relative z-10 pt-2 md:pt-0">
				{TREE_FAMILIES.map((fam, famIdx) => {
					const FamilyIcon = fam.icon

					return (
						<div key={fam.id} className="flex flex-col relative">
							{/* Mobile Trunk Connector (Compact) */}
							<div
								className="w-[1px] h-6 mx-auto md:hidden"
								style={{ backgroundColor: fam.color }}
							/>

							{/* ─── LEVEL 1: CATEGORY NODE (Compact) ─── */}
							<div className="relative border-border px-2.5 py-1.5 md:px-3 md:py-2 bg-card/85 dark:bg-card/60 backdrop-blur-xl border border-border shadow-xs">
								<div className="flex items-center gap-2 min-w-0">
									{/* Family Icon */}
									<div style={{ borderColor: fam.color }} className="size-5 md:size-6 rounded-md flex items-center justify-center shrink-0 border border-border bg-muted/40">
										<FamilyIcon className="size-3 md:size-3.5" style={{ color: fam.color }} />
									</div>

									{/* Category Title */}
									<h3 className="text-[11px] md:text-xs font-semibold font-sans tracking-tight text-foreground truncate">
										{fam.name}
									</h3>
								</div>
							</div>

							{/* Mobile Edge Splitter Fork from Category to Edge Sides */}
							<div className="md:hidden relative h-3 w-full" aria-hidden="true">
								{/* Center stem dropping from bottom center of category card */}
								<div
									className="absolute left-1/2 -translate-x-1/2 top-0 h-1.5 w-[1px]"
									style={{ backgroundColor: fam.color, opacity: 0.7 }}
								/>
								{/* Horizontal bar branching out to left and right edges */}
								<div
									className="absolute top-1.5 left-1.5 right-1.5 h-[1px]"
									style={{ backgroundColor: fam.color, opacity: 0.7 }}
								/>
								{/* Left corner turn dot */}
								<div
									className="absolute left-1 top-1 size-1 rounded-full"
									style={{ backgroundColor: fam.color, boxShadow: `0 0 3px ${fam.color}` }}
								/>
								{/* Right corner turn dot */}
								<div
									className="absolute right-1 top-1 size-1 rounded-full"
									style={{ backgroundColor: fam.color, boxShadow: `0 0 3px ${fam.color}` }}
								/>
								{/* Drops from corners down into the commands container */}
								<div
									className="absolute left-1.5 top-1.5 h-1.5 w-[1px]"
									style={{ backgroundColor: fam.color, opacity: 0.7 }}
								/>
								<div
									className="absolute right-1.5 top-1.5 h-1.5 w-[1px]"
									style={{ backgroundColor: fam.color, opacity: 0.7 }}
								/>
							</div>

							{/* ─── LEVEL 2: CHILDREN COMMANDS (2 columns on mobile, 1 column on desktop) ─── */}
							<div className="relative px-3.5 pt-0.5 pb-0.5 grid grid-cols-2 gap-1.5 md:flex md:flex-col md:pl-11 md:pr-0 md:pt-5 md:pb-0 md:gap-2">
								{/* Desktop Vertical Trunk Line */}
								<div
									className="hidden md:block absolute left-3 top-0 bottom-3 w-[1px] rounded-full overflow-hidden"
									style={{
										backgroundColor: `${fam.color}25`,
										boxShadow: `0 0 4px ${fam.color}20`,
									}}
								>
									<div
										className="w-full h-full"
										style={{
											backgroundImage: `repeating-linear-gradient(to bottom, ${fam.color} 0px, ${fam.color} 5px, transparent 5px, transparent 9px)`,
											backgroundSize: "1px 9px",
											animation: "flowVertical 0.6s linear infinite",
											opacity: 0.65,
										}}
									/>
								</div>

								{/* Mobile Left Vertical Spine */}
								<div
									className="md:hidden absolute left-1.5 top-0 bottom-1.5 w-[1px] rounded-full overflow-hidden"
									style={{
										backgroundColor: `${fam.color}25`,
										boxShadow: `0 0 4px ${fam.color}20`,
									}}
								>
									<div
										className="w-full h-full"
										style={{
											backgroundImage: `repeating-linear-gradient(to bottom, ${fam.color} 0px, ${fam.color} 5px, transparent 5px, transparent 9px)`,
											backgroundSize: "1px 9px",
											animation: "flowVertical 0.6s linear infinite",
											opacity: 0.65,
										}}
									/>
								</div>

								{/* Mobile Right Vertical Spine */}
								<div
									className="md:hidden absolute right-1.5 top-0 bottom-1.5 w-[1px] rounded-full overflow-hidden"
									style={{
										backgroundColor: `${fam.color}25`,
										boxShadow: `0 0 4px ${fam.color}20`,
									}}
								>
									<div
										className="w-full h-full"
										style={{
											backgroundImage: `repeating-linear-gradient(to bottom, ${fam.color} 0px, ${fam.color} 5px, transparent 5px, transparent 9px)`,
											backgroundSize: "1px 9px",
											animation: "flowVertical 0.6s linear infinite",
											opacity: 0.65,
										}}
									/>
								</div>

								{fam.commands.map((cmd, cmdIdx) => {
									const CmdIcon = cmd.icon
									const isCopied = copiedId === cmd.id
									const isEven = cmdIdx % 2 === 0

									return (
										<div key={cmd.id} className="relative flex items-center">
											{/* Desktop Horizontal Branch Line connecting to child */}
											<div
												className="hidden md:block absolute -left-8 w-5 h-[1px]"
												style={{
													backgroundColor: fam.color,
													opacity: 0.55,
												}}
											/>

											{/* Desktop Tree Branch Joint Node */}
											<div
												className="hidden md:block absolute -left-[34px] size-1 rounded-full"
												style={{
													backgroundColor: fam.color,
													boxShadow: `0 0 4px ${fam.color}`,
												}}
											/>

											{/* Mobile Left Branch (Column 1) */}
											{isEven && (
												<>
													<div
														className="md:hidden absolute -left-2 w-2 h-[1px] top-1/2 -translate-y-1/2"
														style={{
															backgroundColor: fam.color,
															opacity: 0.6,
														}}
													/>
													<div
														className="md:hidden absolute -left-[10px] size-1 rounded-full top-1/2 -translate-y-1/2"
														style={{
															backgroundColor: fam.color,
															boxShadow: `0 0 3px ${fam.color}`,
														}}
													/>
												</>
											)}

											{/* Mobile Right Branch (Column 2) */}
											{!isEven && (
												<>
													<div
														className="md:hidden absolute -right-2 w-2 h-[1px] top-1/2 -translate-y-1/2"
														style={{
															backgroundColor: fam.color,
															opacity: 0.6,
														}}
													/>
													<div
														className="md:hidden absolute -right-[10px] size-1 rounded-full top-1/2 -translate-y-1/2"
														style={{
															backgroundColor: fam.color,
															boxShadow: `0 0 3px ${fam.color}`,
														}}
													/>
												</>
											)}

											{/* Command Child Card (Compact) */}
											<Button
												variant={'outline'}
												className={'w-full ml-0 md:-ml-3 flex items-center justify-between'}
												onClick={() => handleCommandClick(cmd)}

												title={`${cmd.description} — Click to copy`}
											>
												<div className="flex items-center gap-1.5 md:gap-2 min-w-0">
													<CmdIcon
														className="size-3 md:size-3.5 shrink-0"
														style={{ color: fam.color }}
													/>

													<span className="text-[10px] md:text-[11px] font-mono font-medium tracking-tight truncate">
														{cmd.name}
													</span>
												</div>

												{/* Command Icon */}
												<div className="flex items-center shrink-0">
													{isCopied ? (
														<Check className="size-2.5 md:size-3 text-emerald-500 shrink-0" />
													) : (
														<Terminal className="size-2.5 md:size-3 text-muted-foreground/40 shrink-0" />
													)}
												</div>
											</Button>
										</div>
									)
								})}
							</div>

							{/* Mobile Bottom Converge (for connector to next family) */}
							{famIdx < TREE_FAMILIES.length - 1 && (
								<div className="md:hidden relative h-3 w-full" aria-hidden="true">
									{/* Left and right stems connecting from vertical spines */}
									<div
										className="absolute left-1.5 top-0 h-1.5 w-[1px]"
										style={{ backgroundColor: fam.color, opacity: 0.7 }}
									/>
									<div
										className="absolute right-1.5 top-0 h-1.5 w-[1px]"
										style={{ backgroundColor: fam.color, opacity: 0.7 }}
									/>
									{/* Horizontal bar converging from left and right edges to center */}
									<div
										className="absolute top-1.5 left-1.5 right-1.5 h-[1px]"
										style={{ backgroundColor: fam.color, opacity: 0.7 }}
									/>
									{/* Left corner turn dot */}
									<div
										className="absolute left-1 top-1 size-1 rounded-full"
										style={{ backgroundColor: fam.color, boxShadow: `0 0 3px ${fam.color}` }}
									/>
									{/* Right corner turn dot */}
									<div
										className="absolute right-1 top-1 size-1 rounded-full"
										style={{ backgroundColor: fam.color, boxShadow: `0 0 3px ${fam.color}` }}
									/>
									{/* Center drop stem leading toward the next category connector */}
									<div
										className="absolute left-1/2 -translate-x-1/2 top-1.5 h-1.5 w-[1px]"
										style={{ backgroundColor: fam.color, opacity: 0.7 }}
									/>
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
