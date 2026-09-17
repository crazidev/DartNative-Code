import { Monitor, Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { buttonVariants } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "cn"

export function ModeToggle() {
	const { theme, setTheme } = useTheme()

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger
					render={
						<DropdownMenuTrigger
							className={cn(
								buttonVariants({ variant: "outline", size: "icon" }),
								"relative cursor-pointer"
							)}
							aria-label="Switch appearance"
						>
							<Sun className="size-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
							<Moon className="absolute size-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
							<span className="sr-only">Toggle theme</span>
						</DropdownMenuTrigger>
					}
				/>
				<TooltipContent>Appearance</TooltipContent>
			</Tooltip>

			<DropdownMenuContent align="end" className="min-w-36">
				<DropdownMenuRadioGroup
					value={theme}
					onValueChange={(val) => setTheme(val as "dark" | "light" | "system")}
				>
					<DropdownMenuRadioItem value="light" className="cursor-pointer gap-2">
						<Sun className="size-3.5" />
						<span>Light</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="dark" className="cursor-pointer gap-2">
						<Moon className="size-3.5" />
						<span>Dark</span>
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="system" className="cursor-pointer gap-2">
						<Monitor className="size-3.5" />
						<span>System</span>
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
