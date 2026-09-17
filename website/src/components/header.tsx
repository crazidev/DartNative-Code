import {
	AntigravityIcon,
	CursorIcon,
	GithubIcon,
	VScodeIcon,
	XIcon,
} from "@/components/icons"
import { ModeToggle } from "@/components/mode-toggle"
import { Button, buttonVariants } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "cn"
import { Check, ChevronDown } from "lucide-react"
import * as React from "react"

const IDES = [
	{
		id: "cursor",
		name: "Cursor",
		icon: CursorIcon,
		deepLink: "cursor:extension/Beatcode-studio.dartnative",
	},
	{
		id: "antigravity",
		name: "Antigravity IDE",
		icon: AntigravityIcon,
		deepLink: "antigravity-ide:extension/Beatcode-studio.dartnative",
	},
	{
		id: "vscode",
		name: "VS Code",
		icon: VScodeIcon,
		deepLink: "vscode:extension/Beatcode-studio.dartnative",
	},
] as const

type IDE = (typeof IDES)[number]

export function Header() {
	const [selectedIde, setSelectedIde] = React.useState<IDE>(IDES[2])
	const SelectedIcon = selectedIde.icon

	return (
		<TooltipProvider delay={200}>
			<header className="sticky top-0 z-40 w-full  transition-colors">
				<div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
					<nav className="flex items-center gap-1 sm:gap-1.5">
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										variant="outline"
										size="icon"
										nativeButton={false}
										className="cursor-pointer"
										render={
											<a
												href="https://github.com/crazidev/DartNative-Code"
												target="_blank"
												rel="noreferrer"
												aria-label="GitHub Repository"
											/>
										}
									>
										<GithubIcon className="size-4" />
									</Button>
								}
							/>
							<TooltipContent>GitHub</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										variant="outline"
										size="icon"
										nativeButton={false}
										className="cursor-pointer"
										render={
											<a
												href="https://x.com"
												target="_blank"
												rel="noreferrer"
												aria-label="X (formerly Twitter)"
											/>
										}
									>
										<XIcon className="size-3.5" />
									</Button>
								}
							/>
							<TooltipContent>X</TooltipContent>
						</Tooltip>

						<ModeToggle />
					</nav>

					<div className="flex items-center">
						<div className="inline-flex items-center -space-x-px">
							<Button
								nativeButton={false}
								className="cursor-pointer gap-2 rounded-r-none pr-3"
								render={
									<a
										href={selectedIde.deepLink}
										aria-label={`Download on ${selectedIde.name}`}
									/>
								}
							>
								<SelectedIcon className="size-4 shrink-0" />
								<span>Download on {selectedIde.name}</span>
							</Button>

							<DropdownMenu>
								<DropdownMenuTrigger
									className={cn(
										buttonVariants({ variant: "default", size: "icon" }),
										"cursor-pointer rounded-l-none border-l border-primary-foreground/25 px-2"
									)}
									aria-label="Select IDE"
								>
									<ChevronDown className="size-3.5 opacity-80" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-48 p-1">
									<DropdownMenuGroup>
										<DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
											Choose IDE
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{IDES.map((ide) => {
											const Icon = ide.icon
											const isSelected = selectedIde.id === ide.id
											return (
												<DropdownMenuItem
													key={ide.id}
													onClick={() => setSelectedIde(ide)}
													className="flex cursor-pointer items-center justify-between gap-2.5 px-2.5 py-2 text-xs"
												>
													<div className="flex items-center gap-2">
														<Icon className="size-4 shrink-0" />
														<span className="font-medium">{ide.name}</span>
													</div>
													{isSelected && (
														<Check className="size-3.5 text-muted-foreground" />
													)}
												</DropdownMenuItem>
											)
										})}
									</DropdownMenuGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>
			</header>
		</TooltipProvider>
	)
}

