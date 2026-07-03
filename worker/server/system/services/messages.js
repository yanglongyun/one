export const truncateToolResult = (content, { enabled = true, maxChars = 12000 } = {}) => {
    const limit = Math.max(1000, Math.min(50000, Number(maxChars) || 12000));
    const text = String(content ?? '');
    if (!enabled || text.length <= limit) {
        return { content: text, truncated: false, originalLength: text.length };
    }
    const head = Math.floor(limit * 0.7);
    const tail = limit - head;
    const clipped = `${text.slice(0, head)}\n...[truncated ${text.length - limit} chars]...\n${text.slice(-tail)}`;
    return { content: clipped, truncated: true, originalLength: text.length };
};

