import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySql } from '../server/system/services/sql.js';

test('查询系统表仍是只读操作', () => {
    assert.equal(classifySql('WITH recent AS (SELECT * FROM tasks) SELECT * FROM recent;'), 'read');
});

test('只允许 app_ 数据表写入和建表', () => {
    assert.equal(classifySql('INSERT INTO app_notes (body) VALUES (?)'), 'write');
    assert.equal(classifySql('CREATE TABLE IF NOT EXISTS "app_notes" (id INTEGER PRIMARY KEY)'), 'write');
    assert.equal(classifySql('CREATE INDEX IF NOT EXISTS idx_notes ON app_notes(id)'), 'write');
    assert.throws(() => classifySql('UPDATE memories SET title = ?'), /只允许 app_/);
    assert.throws(() => classifySql('CREATE TABLE app_notes (parent INTEGER REFERENCES tasks(id))'), /外键/);
});

test('拒绝多语句和非 SQL 管理命令', () => {
    assert.throws(() => classifySql('SELECT 1; DELETE FROM app_notes'), /一条 SQL/);
    assert.throws(() => classifySql('PRAGMA table_info(app_notes)'), /不支持/);
});
