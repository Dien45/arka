// Fallback parser for the textual tool-call convention Arka's own system
// prompt teaches the model to use ("[TOOL_CALL:tool_name] {json} [/TOOL_CALL]")
// as a hint for models/providers that don't reliably return native,
// structured `tool_calls` (some self-hosted/local models, weaker custom
// endpoints, etc).
//
// In practice some of those models follow the *idea* but not the exact
// syntax — e.g. they mix in a `<parameter=key>value</parameter>` style they
// picked up from some other agent framework's tool-call format, or they
// drop the closing "[/TOOL_CALL]" tag entirely. Before this module existed,
// none of that text was ever parsed back into a real tool call — it just
// got rendered verbatim in the chat bubble (e.g. a request to write a file
// showed up as literal "[TOOL_CALL:write_file] <parameter=path>...") and
// nothing ever actually happened. This module recovers a usable tool call
// from either shape so it can actually be executed like a normal one.

export interface ParsedTextToolCall {
  id: string;
  name: string;
  /** JSON-encoded, matching the shape aiService's native toolCalls use. */
  arguments: string;
}

export interface TextToolCallExtraction {
  toolCalls: ParsedTextToolCall[];
  /** Original content with the matched tool-call block(s) stripped out. */
  cleanedContent: string;
}

// Non-greedy body capture, terminated by a proper "[/TOOL_CALL]" close tag,
// a stray "</function>" some models emit instead, the start of the next
// tool-call block, or simply the end of the string — whichever comes first.
const BLOCK_RE = /\[TOOL_CALL:\s*([a-zA-Z0-9_]+)\s*\]([\s\S]*?)(?:\[\/TOOL_CALL\]|<\/function>|(?=\[TOOL_CALL:)|$)/g;

// Matches both "<parameter=key>value</parameter>" and
// "<parameter name=\"key\">value</parameter>" style tags, tolerating a
// missing closing tag the same way BLOCK_RE does.
const PARAM_TAG_RE = /<parameter(?:\s+name)?\s*[=:]\s*"?([a-zA-Z0-9_]+)"?\s*>([\s\S]*?)(?:<\/parameter>|(?=<parameter)|$)/g;

let uid = 0;

function parseBlockBody(body: string): Record<string, unknown> | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  // 1) The documented convention: a raw JSON object.
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through — some models wrap near-valid JSON with extra
      // whitespace/junk that breaks strict parsing; try the tag form next.
    }
  }

  // 2) The <parameter=key>value</parameter> convention some models invent
  // instead of (or alongside) the documented JSON body.
  const params: Record<string, string> = {};
  let found = false;
  let match: RegExpExecArray | null;
  PARAM_TAG_RE.lastIndex = 0;
  while ((match = PARAM_TAG_RE.exec(body)) !== null) {
    found = true;
    const key = match[1];
    let value = match[2];
    // Strip at most one leading/trailing newline introduced by the tag
    // boundary, but otherwise preserve the value's own formatting — it may
    // be real file content where internal whitespace matters.
    value = value.replace(/^\n/, '').replace(/\n$/, '');
    if (!value.includes('\n')) value = value.trim();
    params[key] = value;
    if (match[0].length === 0) PARAM_TAG_RE.lastIndex++;
  }
  return found ? params : null;
}

/**
 * Scans `content` for one or more textual tool-call blocks. Returns any
 * calls it could recover plus the content with those blocks removed, so
 * genuine narration text around them still reaches the user instead of
 * raw tool-call syntax.
 */
export function extractTextToolCalls(content: string): TextToolCallExtraction {
  if (!content || !content.includes('[TOOL_CALL:')) {
    return { toolCalls: [], cleanedContent: content };
  }

  const toolCalls: ParsedTextToolCall[] = [];
  let cleanedContent = content;

  BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_RE.exec(content)) !== null) {
    const [fullMatch, name, body] = match;
    const args = parseBlockBody(body);
    if (args !== null) {
      toolCalls.push({
        id: `text_toolcall_${Date.now()}_${uid++}`,
        name,
        arguments: JSON.stringify(args),
      });
      cleanedContent = cleanedContent.replace(fullMatch, '');
    }
    if (match[0].length === 0) BLOCK_RE.lastIndex++;
  }

  return { toolCalls, cleanedContent: cleanedContent.trim() };
}
