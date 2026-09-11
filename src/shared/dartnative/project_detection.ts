import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";
import { hasPubspec } from "../utils/fs";

// NOTE: These functions were extracted from src/shared/utils/fs.ts to keep
// upstream modifications minimal. Upstream fs.ts re-exports from here.

export function isDartNativeProjectFolder(folder?: string): boolean {
	return projectReferencesDartNative(folder);
}

export function projectReferencesDartNative(folder?: string): boolean {
	if (folder && hasPubspec(folder)) {
		const pubspecPath = path.join(folder, "pubspec.yaml");
		try {
			const pubspecContent = fs.readFileSync(pubspecPath);
			return pubspecContentReferencesDartNative(pubspecContent.toString());
		} catch (e: any) {
			if (e?.code !== "ENOENT") // Don't warn for missing files.
				console.warn(`Failed to read ${pubspecPath}: ${e}`);
		}
	}
	return false;
}

export function pubspecContentReferencesDartNative(content: string): boolean {
	if (!content.includes("dartnative"))
		return false;
	try {
		const yaml = YAML.parse(content);
		return !!(yaml?.dependencies?.dartnative || yaml?.dartnative);
	} catch {
		return false;
	}
}
