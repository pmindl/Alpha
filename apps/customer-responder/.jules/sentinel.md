## 2024-05-22 - [MCP Tool Parameter Logging]
**Vulnerability:** PII (email addresses) leakage in MCP tool execution logs.
**Learning:** MCP tools often log their input parameters for debugging, but this can inadvertently expose sensitive data like PII if not redacted, especially since these logs might be consumed by the client or stored centrally.
**Prevention:** Always sanitize or redact sensitive fields in tool execution logs, or use a structured logging library that handles redaction automatically.

## 2026-02-22 - [Raw Email Construction Risks]
**Vulnerability:** Email Header Injection (SMTP Injection) when using Google Gmail API's `raw` message format.
**Learning:** Manually constructing MIME messages by string concatenation is dangerous. If user input (like 'Subject' or 'To') contains unescaped newlines (`\r` or `\n`), attackers can inject arbitrary headers (e.g., `Bcc`, `Reply-To`) or manipulate the email body, potentially bypassing security controls or phishing users.
**Prevention:** Avoid manual MIME construction. Use dedicated libraries like `nodemailer` or `mailcomposer` that handle encoding and sanitization automatically. If manual construction is necessary, strictly sanitize all header fields by removing control characters (specifically CR and LF).

## 2026-02-23 - [Secret Leakage in Error Logs]
**Vulnerability:** Exposure of API credentials and secrets in application logs via full error object logging.
**Learning:** Libraries like `axios` include the full request configuration (including headers and body) in their error objects. When `console.error(error)` is used blindly, it dumps these details, potentially exposing API keys, passwords, and tokens to logging systems (e.g., Splunk, Datadog, or stdout).
**Prevention:** Never log the raw `error` object. Create a sanitized logging utility that extracts only safe fields (like `message`, `status`, and `response.data` - ensuring data doesn't contain secrets) and explicitly excludes `config`, `request`, and `headers`.

## 2026-02-24 - [Unauthenticated Configuration Modification via Environment Injection]
**Vulnerability:** An unauthenticated API endpoint allowed users to modify critical application configuration (`.env.local`) by sending a POST request with arbitrary data. This could be exploited to overwrite sensitive credentials or inject malicious environment variables via newline characters.
**Learning:** Never expose administrative or setup endpoints without strong authentication. Writing user-supplied data directly to configuration files is inherently risky, especially when format validation (like checking for newlines in `.env` files) is missing.
**Prevention:** Secure all administrative endpoints with strong authentication (e.g., API keys, OAuth). Validate and sanitize all inputs before writing to sensitive files, ensuring no control characters (like `\n`) can be injected to alter the file structure. Prefer environment variables or secure secret stores over runtime file modification.

## 2026-02-26 - [LLM Prompt Injection via Delimiter Manipulation]
**Vulnerability:** User-supplied inputs (email body, subject) were directly interpolated into an LLM prompt block delimited by `"""`. An attacker could inject `"""` to prematurely close the block and insert malicious instructions (Prompt Injection), potentially manipulating the model's output or exfiltrating data.
**Learning:** Text-based LLM prompts that use delimiters to separate instructions from data are vulnerable if the data itself can contain the delimiter. Simple string interpolation is insufficient for security when handling untrusted input in prompts.
**Prevention:** Sanitize all user inputs before including them in prompts. Replace or escape the delimiter sequence (e.g., replace `"""` with `'''` or `\"\"\"`) to ensure the model treats the input as data, not instructions. Alternatively, use structured prompting APIs (like Gemini's `parts`) that separate system instructions from user content.
