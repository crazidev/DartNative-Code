import * as path from "path";
import * as vs from "vscode";
import { DartCapabilities } from "../../shared/capabilities/dart";
import { dartVMPath } from "../../shared/constants";
import { DartSdks, IAmDisposable } from "../../shared/interfaces";
import { disposeAll } from "../../shared/utils";
import { config } from "../config";
import { getToolEnv } from "../utils/processes";

export class DartMcpServerDefinitionProvider implements vs.McpServerDefinitionProvider, IAmDisposable {
	// Flutter-only tools from the SDK MCP server. These rely on Flutter
	// tooling that is not available in DartNative projects, so never expose
	// them. DartNative equivalents are provided by the `dn_*` tools.
	private readonly unsupportedDartNativeTools = [
		"flutter_driver_command",
		"get_app_logs",
		"get_selected_widget",
		"get_widget_tree",
		"launch_app",
		"list_devices",
		"list_running_apps",
		"set_widget_selection_mode",
		"stop_app",
	];

	private readonly disposables: IAmDisposable[] = [];

	private onDidChangeMcpServerDefinitionsEmitter: vs.EventEmitter<void> = new vs.EventEmitter<void>();
	public readonly onDidChangeMcpServerDefinitions: vs.Event<void> = this.onDidChangeMcpServerDefinitionsEmitter.event;

	constructor(private readonly sdks: DartSdks, private readonly dartCapabilities: DartCapabilities) {
		const mcpSettings = ["mcpServer", "mcpServerLogFile", "mcpServerTools"];
		// Inform VS Code the MCP server list changed when its settings change.
		this.disposables.push(vs.workspace.onDidChangeConfiguration((e) => {
			if (mcpSettings.some((setting) => e.affectsConfiguration(`dartnative.${setting}`) || e.affectsConfiguration(`dart.${setting}`))) {
				this.onDidChangeMcpServerDefinitionsEmitter.fire();
			}
		}));
	}

	public async provideMcpServerDefinitions(_token: vs.CancellationToken): Promise<vs.McpServerDefinition[]> {
		// Dart SDK doesn't support it.
		if (!this.dartCapabilities.supportsMcpServer)
			return [];

		// Not enabled.
		if (!config.mcpServer)
			return [];


		const binPath = path.join(this.sdks.dart, dartVMPath);
		const args = ["mcp-server"];
		if (this.dartCapabilities.mcpServerRequiresExperimentalFlag)
			args.push("--experimental-mcp-server");

		// Add log file flag if configured and supported
		if (config.mcpServerLogFile && this.dartCapabilities.supportsMcpServerLogFile)
			args.push("--log-file", config.mcpServerLogFile);

		// Add exclude-tool flags if supported and configured (tools set to false are excluded).
		if (this.dartCapabilities.supportsMcpServerExcludeTool) {
			const tools: Record<string, boolean> = config.mcpServerTools ?? {};
			for (const [toolName, enabled] of Object.entries(tools)) {
				if (!enabled)
					args.push("--exclude-tool", toolName);
			}
			for (const toolName of this.unsupportedDartNativeTools)
				args.push("--exclude-tool", toolName);
		}

		return [
			new vs.McpStdioServerDefinition("DartNative SDK MCP Server", binPath, args, getToolEnv()),
		];
	}

	public dispose(): void {
		disposeAll(this.disposables);
	}
}
