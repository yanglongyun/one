export function chatPayload({
    model,
    messages,
    tools,
    responseFormat,
    stream = true,
    thinkingEnabled = false,
    reasoningEffort = '',
    maxOutputTokens = 0,
}) {
    const payload = { model, messages, stream };
    if (Array.isArray(tools) && tools.length) payload.tools = tools;
    if (responseFormat) payload.response_format = responseFormat;
    if (stream) payload.stream_options = { include_usage: true };
    if (thinkingEnabled === true || thinkingEnabled === '1') payload.thinking = { type: 'enabled' };
    if (reasoningEffort) payload.reasoning_effort = reasoningEffort;
    if (Number(maxOutputTokens) > 0) payload.max_tokens = Math.min(384000, Math.max(1, Number(maxOutputTokens)));
    return payload;
}
