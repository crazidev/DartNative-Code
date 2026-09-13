import * as fs from "fs";
import * as path from "path";
import { DebugAdapterDescriptor, DebugAdapterDescriptorFactory, DebugAdapterExecutable, DebugAdapterExecutableOptions, DebugSession } from "vscode";
import { DartCapabilities } from "../../shared/capabilities/dart";
import { FlutterCapabilities } from "../../shared/capabilities/flutter";
import { dartVMPath, debugAdapterPath, executableNames, flutterPath } from "../../shared/constants";
import { DebuggerType } from "../../shared/enums";
import { DartSdks, Logger } from "../../shared/interfaces";
import { getDebugAdapterName } from "../../shared/utils/debug";
import { fsPath, isDartNativeProjectFolder } from "../../shared/utils/fs";
import { Context } from "../../shared/vscode/workspace";
import { WorkspaceContext } from "../../shared/workspace";
import { Analytics } from "../analytics";
import { config } from "../config";
import { KnownExperiments } from "../experiments";
import { isPathInsideDartNativeProject } from "../utils";
import { getToolEnv } from "../utils/processes";

export class DartDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
	constructor(private readonly analytics: Analytics, private readonly sdks: DartSdks, private readonly logger: Logger, private readonly extensionContext: Context, private readonly dartCapabilities: DartCapabilities, private readonly flutterCapabilities: FlutterCapabilities, private readonly workspaceContext: WorkspaceContext, private readonly experiments: KnownExperiments) { }

	public createDebugAdapterDescriptor(session: DebugSession): DebugAdapterDescriptor {
		return this.descriptorForType(session.configuration.debuggerType as DebuggerType, !!session.configuration.noDebug, session);
	}

	public descriptorForType(debuggerType: DebuggerType, noDebug?: boolean, session?: DebugSession): DebugAdapterDescriptor {
		const debuggerName = getDebugAdapterName(debuggerType);
		this.logger.info(`Using ${debuggerName} debugger for ${DebuggerType[debuggerType]}`);

		const isDartOrDartTest = debuggerType === DebuggerType.Dart || debuggerType === DebuggerType.DartTest;
		const isFlutterOrFlutterTest = debuggerType === DebuggerType.Flutter || debuggerType === DebuggerType.FlutterTest;
		const isDartTestOrFlutterTest = debuggerType === DebuggerType.DartTest || debuggerType === DebuggerType.FlutterTest;
		const isDartTest = debuggerType === DebuggerType.DartTest;
		const isFlutterTest = debuggerType === DebuggerType.FlutterTest;

		const useSdkDap = this.workspaceContext.config.forceFlutterWorkspace || isDartOrDartTest || isFlutterOrFlutterTest;
		this.logger.info(`SDK DAP setting is ${useSdkDap} for debugger ${debuggerType}`);

		const analytics = this.analytics;
		function logDebuggerStart(sdkDap: boolean) {
			analytics.logDebuggerStart(
				DebuggerType[debuggerType],
				noDebug ? "Run" : "Debug",
				sdkDap,
			);
		}

		const toolEnv = getToolEnv();
		const executableOptions: DebugAdapterExecutableOptions = {
			env: toolEnv,
		};

		if (config.customDartDapPath && isDartOrDartTest) {
			const args = [config.customDartDapPath, "debug_adapter"];
			if (isDartTest)
				args.push("--test");

			this.logger.info(`Running custom Dart debugger using Dart VM with args ${args.join("    ")} and options ${JSON.stringify(executableOptions)}`);
			return new DebugAdapterExecutable(path.join(this.sdks.dart, dartVMPath), args, executableOptions);
		} else if (config.customFlutterDapPath && isFlutterOrFlutterTest) {
			const args = [config.customFlutterDapPath, "debug_adapter"];
			if (isFlutterTest)
				args.push("--test");

			this.logger.info(`Running custom Flutter debugger using Dart VM with args ${args.join("    ")} and options ${JSON.stringify(executableOptions)}`);
			return new DebugAdapterExecutable(path.join(this.sdks.dart, dartVMPath), args, executableOptions);
		} else if (useSdkDap) {
			const conf = session?.configuration as { cwd?: string; program?: string } | undefined;
			const cwd = typeof conf?.cwd === "string" ? conf.cwd : undefined;
			const program = typeof conf?.program === "string" ? conf.program : undefined;
			const isDartNative = (session?.workspaceFolder && isDartNativeProjectFolder(fsPath(session.workspaceFolder.uri)))
				|| (cwd && isDartNativeProjectFolder(cwd))
				|| (program && isPathInsideDartNativeProject(program))
				|| (this.sdks.flutter && fs.existsSync(path.join(this.sdks.flutter, "bin", executableNames.dn)));

			let flutterExecutable = this.sdks.flutter ? path.join(this.sdks.flutter, flutterPath) : executableNames.flutter;
			if (isDartNative && this.sdks.flutter) {
				const dnPath = path.join(this.sdks.flutter, "bin", executableNames.dn);
				if (fs.existsSync(dnPath))
					flutterExecutable = dnPath;
			} else if (this.sdks.flutter && !fs.existsSync(flutterExecutable)) {
				const dnPath = path.join(this.sdks.flutter, "bin", executableNames.dn);
				if (fs.existsSync(dnPath))
					flutterExecutable = dnPath;
			}
			const executable = isDartOrDartTest
				? path.join(this.sdks.dart, dartVMPath)
				: this.workspaceContext.config.flutterToolsScript?.script ?? flutterExecutable;

			const args = ["debug_adapter"];
			if (isDartTestOrFlutterTest)
				args.push("--test");

			if (this.workspaceContext.config.flutterSdkHome)
				executableOptions.cwd = this.workspaceContext.config.flutterSdkHome;

			this.logger.info(`Running SDK DAP Dart VM in ${executableOptions.cwd}: ${executable} ${args.join("    ")} and options ${JSON.stringify(executableOptions)}`);
			logDebuggerStart(true);
			return new DebugAdapterExecutable(executable, args, executableOptions);
		}

		const args = [this.extensionContext.asAbsolutePath(debugAdapterPath), debuggerName];
		this.logger.info(`Running legacy debug adapter via node with ${args.join("    ")}`);
		logDebuggerStart(false);
		return new DebugAdapterExecutable("node", args);
	}
}
