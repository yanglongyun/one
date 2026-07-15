import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesCron, nextCronOccurrence, parseCron } from '../server/system/realtime/cron.js';

test('数字起点步进持续到字段上限', () => {
    const minutes = parseCron('5/10 * * * *')[0];
    assert.deepEqual([...minutes], [5, 15, 25, 35, 45, 55]);
});

test('日期和星期都受限时使用 cron 的 OR 语义', () => {
    assert.equal(matchesCron('0 0 15 * 1', Date.UTC(2026, 6, 6), 'UTC'), true);
    assert.equal(matchesCron('0 0 15 * 1', Date.UTC(2026, 6, 15), 'UTC'), true);
    assert.equal(matchesCron('0 0 15 * 1', Date.UTC(2026, 6, 7), 'UTC'), false);
});

test('下一次触发严格晚于给定时间', () => {
    const after = Date.UTC(2026, 0, 1, 8, 30);
    assert.equal(nextCronOccurrence('30 8 * * *', 'UTC', after), Date.UTC(2026, 0, 2, 8, 30));
});
