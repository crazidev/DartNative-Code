import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react"
import logo from "./assets/dartnative.png"
import { CommandsShowcase } from "./components/commands-showcase"
import { Header } from "./components/header"

export function App() {
	return (
		<div className="relative min-h-screen flex flex-col text-foreground selection:bg-primary selection:text-primary-foreground">
			{/* Fixed Mesh Background Layer */}
			<div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
				<ShaderGradientCanvas
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
					}}
					pixelDensity={1}
					pointerEvents="none"
				>
					<ShaderGradient
						animate="on"
						type="waterPlane"
						wireframe={false}
						shader="defaults"
						uTime={8}
						uSpeed={0.1}
						uStrength={1.3}
						uDensity={1.5}
						uFrequency={0}
						uAmplitude={0}
						positionX={0}
						positionY={0}
						positionZ={0}
						rotationX={50}
						rotationY={0}
						rotationZ={-60}
						color1="#806624ff"
						color2="#8d7dca"
						color3="#212121"
						reflection={0.1}
						// View (camera) props
						cAzimuthAngle={180}
						cPolarAngle={80}
						cDistance={2.8}
						cameraZoom={9.1}
						// Effect props
						lightType="3d"
						brightness={1}
						envPreset="city"
						grain="on"
						// Tool props
						toggleAxis={false}
						zoomOut={false}
						hoverState=""
						enableTransition={false}
					/>
				</ShaderGradientCanvas>
				{/* Backdrop covering the mesh just like before the first changes */}
				<div className="absolute inset-0 bg-background/100 dark:bg-background/50 backdrop-blur-xl" />
			</div>

			{/* Sticky Header */}
			<Header />

			{/* Main Content */}
			<main className="relative z-10 flex-1 flex flex-col items-center justify-start w-full">
				<div className="flex max-w-6xl mx-auto w-full flex-1 flex-col items-center justify-start px-4 pt-10 pb-8 sm:px-6">
					{/* Logo with Ambient Glow */}
					<div className="relative mb-5 group">
						<div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#f65c93]/30 via-[#8d7dca]/30 to-[#05c3f0]/30 blur-3xl pointer-events-none transition-all group-hover:scale-110" />
						<img
							src={logo}
							alt="Dart Native Logo"
							className="relative size-24 sm:size-28 select-none drop-shadow-lg transition-transform duration-300 hover:scale-105"
						/>
					</div>



					{/* Title & Tagline */}
					<h1 className="text-2xl sm:text-3xl md:text-4xl font-digital mt-3 font-bold tracking-tight text-center max-w-3xl text-foreground">
						Dart Native: IDE Extension
					</h1>
					<p className="text-muted-foreground font-mono text-center text-xs sm:text-sm max-w-xl mt-3 mb-6">
						Speed up development with the fastest hot reload, hot restart, breakpoints, memory & network insights—all in your IDE.
					</p>
					{/* Status Badge */}
					<div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-[11px] font-mono font-medium text-muted-foreground backdrop-blur-md shadow-2xs">
						<span>VS Code • Cursor • Antigravity IDE</span>
					</div>



					{/* Commands Category & Animated Commands Showcase */}
					<CommandsShowcase />
				</div>
			</main>

			{/* Minimal Footer */}
			<footer className="relative z-10 w-full border-t border-border/40 py-6 mt-12 text-center text-xs text-muted-foreground font-mono">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<span className="font-medium text-foreground">DartNative</span>
						<span>—</span>
						<span>High Performance Dart Framework Tooling</span>
					</div>
					<div className="flex items-center gap-4">
						<a
							href="https://github.com/crazidev/DartNative-Code"
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-4 hover:text-foreground transition-colors"
						>
							GitHub
						</a>
						<a
							href="https://github.com/crazidev/DartNative-Code/issues"
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-4 hover:text-foreground transition-colors"
						>
							Issues
						</a>
						<a
							href="https://dartnative.com"
							target="_blank"
							rel="noreferrer"
							className="underline underline-offset-4 hover:text-foreground transition-colors"
						>
							dartnative.com
						</a>
					</div>
				</div>
			</footer>
		</div>
	)
}

export default App

