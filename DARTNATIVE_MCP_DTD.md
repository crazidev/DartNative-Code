# DartNative MCP to IDE attach bridge

The DartNative extension publishes its active Dart Tooling Daemon (DTD) endpoint to each open workspace while the DTD is running. This lets MCP clients such as OpenCode discover the IDE without depending on VS Code language-model tools.

## Discovery

Read `.dart_tool/dartnative_dtd.json` from the DartNative project root. The file is created by the extension, has mode `0600` where supported, and is removed when the extension shuts down or the workspace is closed.

```json
{
  "version": 1,
  "workspaceRoot": "/path/to/project",
  "dtdUri": "ws://127.0.0.1:12345/",
  "capability": "<short-lived random capability>",
  "updatedAt": "2026-11-04T12:00:00.000Z"
}
```

Treat this file as a runtime secret: do not commit it, log its capability, or retain it after the DTD connection fails. A stale descriptor should be treated as unavailable and retried after the extension republishes it.

## Attach request

After the MCP server launches the app and obtains its VM Service URI, connect to `dtdUri` with WebSocket and send this JSON-RPC request:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "Editor.attachToVmService",
  "params": {
    "capability": "<capability from descriptor>",
    "vmServiceUri": "ws://127.0.0.1:8181/<vm-service-token>/",
    "name": "DartNative MCP app",
    "projectRoot": "/path/to/project"
  }
}
```

`name` and `projectRoot` are optional. The response is `result.type: "Success"` when VS Code starts the attach session. An `error` response means the request was rejected or the debugger failed to start. The VM Service URI is also a credential; avoid logging it.

The MCP server should discover the descriptor from the launched project's root, use the VM Service URI returned by its launch workflow, and make the DTD request automatically. If the MCP server and extension run in different containers or remote environments, the MCP process must be able to access both the descriptor and the DTD URI's network endpoint.
