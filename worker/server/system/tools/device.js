export async function executeDeviceTool(name, args, { hub, threadId, signal } = {}) {
    const target = pickDevice(hub.executors(), name, args.device);
    if (target.error) return { error: target.error };
    const { __toolCallId, ...deviceArgs } = args;

    const sent = hub.toExecutor(target.name, {
        type: 'chat.tool.calls',
        threadId,
        calls: [{ id: __toolCallId, name, args: deviceArgs }],
    });
    if (!sent) return { error: `设备「${target.name}」已离线或发送失败` };

    return hub.awaitResult(threadId, __toolCallId, signal);
}

export function pickDevice(executors, toolName, explicit) {
    const capable = executors.filter((e) => (e.caps || []).includes(toolName));
    if (explicit) {
        const match = executors.find((e) => e.name === explicit);
        if (!match) return { error: `没有名为「${explicit}」的在线设备` };
        if (!(match.caps || []).includes(toolName)) return { error: `设备「${explicit}」不支持 ${toolName}` };
        return { name: match.name };
    }
    if (capable.length === 1) return { name: capable[0].name };
    if (capable.length === 0) return { error: `没有能执行 ${toolName} 的在线设备` };
    return { error: `有多台设备可执行 ${toolName}:${capable.map((e) => e.name).join('、')}。请在指令里指明用哪台(device=设备名)。` };
}
