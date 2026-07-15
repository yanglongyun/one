import test from 'node:test';
import assert from 'node:assert/strict';
import { executorHello } from '../server/system/realtime/protocol.js';

const hello = { type: 'hello', protocolVersion: 1, clientVersion: '0.4.0', name: '我的设备', caps: ['shell', 'shell'] };

test('桌面执行端只接受当前协议并去重能力', () => {
    assert.deepEqual(executorHello({ ...hello, kind: 'desktop' }, 'device'), {
        protocolVersion: 1,
        clientVersion: '0.4.0',
        name: '我的设备',
        kind: 'desktop',
        caps: ['shell'],
    });
});

test('拒绝旧协议、空版本和错误通道类型', () => {
    assert.equal(executorHello({ ...hello, kind: 'desktop', protocolVersion: 0 }, 'device'), null);
    assert.equal(executorHello({ ...hello, kind: 'desktop', clientVersion: '' }, 'device'), null);
    assert.equal(executorHello({ ...hello, kind: 'browser' }, 'device'), null);
    assert.equal(executorHello({ ...hello, kind: 'desktop' }, 'browser'), null);
});
