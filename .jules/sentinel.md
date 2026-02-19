## 2024-05-22 - [MCP Tool Parameter Logging]
**Vulnerability:** PII (email addresses) leakage in MCP tool execution logs.
**Learning:** MCP tools often log their input parameters for debugging, but this can inadvertently expose sensitive data like PII if not redacted, especially since these logs might be consumed by the client or stored centrally.
**Prevention:** Always sanitize or redact sensitive fields in tool execution logs, or use a structured logging library that handles redaction automatically.
