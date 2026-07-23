import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySql } from '../server/system/services/sql.js';

test('SELECT(含 WITH)是唯一放行的语句', () => {
    assert.equal(classifySql('SELECT * FROM notes'), 'read');
    assert.equal(classifySql('WITH recent AS (SELECT * FROM tasks) SELECT * FROM recent;'), 'read');
});

test('拒绝一切写操作', () => {
    assert.throws(() => classifySql('INSERT INTO notes (content) VALUES (?)'), /one_manage/);
    assert.throws(() => classifySql('UPDATE memories SET title = ?'), /one_manage/);
    assert.throws(() => classifySql('DELETE FROM notes'), /one_manage/);
    assert.throws(() => classifySql('CREATE TABLE x (id INTEGER PRIMARY KEY)'), /one_manage/);
    assert.throws(() => classifySql('DROP TABLE notes'), /one_manage/);
});

test('拒绝多语句和非 SQL 管理命令', () => {
    assert.throws(() => classifySql('SELECT 1; DELETE FROM notes'), /一条 SQL/);
    assert.throws(() => classifySql('PRAGMA table_info(notes)'), /one_manage/);
});
