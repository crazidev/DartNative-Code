import { ExtensionContext, window } from "vscode";
import { LogCategory } from "../../shared/enums";
import { DaemonLog, DaemonLogMessage, ShowMessage } from "../../shared/flutter/daemon_interfaces";
import { IFlutterDaemon, Logger } from "../../shared/interfaces";

export function setUpDaemonMessageHandler(logger: Logger, context: ExtensionContext, daemon: IFlutterDaemon) {
	context.subscriptions.push(daemon.registerForDaemonLog((l: DaemonLog) => {
		const prefix = l.error ? "[ERR] " : "";
		logger.info(`${prefix}${l.log}`, LogCategory.FlutterDaemon);
	}));
	context.subscriptions.push(daemon.registerForDaemonLogMessage((l: DaemonLogMessage) => {
		const prefix = l.level === "error"
			? "[ERR] "
			: l.level === "warning"
				? "[WARN] " : "";
		logger.info(`${prefix}${l.message}`, LogCategory.FlutterDaemon);
	}));
	context.subscriptions.push(daemon.registerForDaemonShowMessage((l: ShowMessage) => {
		const title = l.title.trim().endsWith(".") ? l.title.trim() : `${l.title.trim()}.`;
		const message = `${title} ${l.message}`.trim();
		switch (l.level) {
			case "info":
				void window.showInformationMessage(message);
				break;
			case "warning":
				void window.showWarningMessage(message);
				break;
			case "error":
				void window.showErrorMessage(message);
				break;
			default:
				logger.warn(`Unexpected daemon.showMessage type: ${l.level}`);
		}
	}));
}
