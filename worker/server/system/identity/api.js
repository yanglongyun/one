// identity api 层:/api/identity/<command>
import * as service from './service.js';

export default async function identityApi(request, ctx, command) {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    try {
        switch (command) {
            case 'state':           return Response.json(await service.state(ctx));
            case 'setup':           return Response.json(await service.setup(ctx, body));
            case 'login':           return Response.json(await service.login(ctx, body));
            case 'change-password': return Response.json(await service.changePassword(ctx, body));
            case 'register-device': return Response.json(await service.registerDevice(ctx, body));
            case 'devices':         return Response.json(await service.listDevices(ctx));
            default:                return Response.json({ error: `unknown identity command: ${command}` }, { status: 404 });
        }
    } catch (err) {
        // 把「AUTH_SECRET 未配置」等部署期错误清楚地透给操作者,而不是不透明的 500。
        return Response.json({ ok: false, error: err.message || String(err) }, { status: 500 });
    }
}
