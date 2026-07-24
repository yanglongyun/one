import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySql } from '../server/system/services/sql.js';

test('SELECT(含 WITH)和 PRAGMA 为读操作', () => {
    assert.equal(classifySql('SELECT * FROM notes'), 'read');
    assert.equal(classifySql('WITH recent AS (SELECT * FROM tasks) SELECT * FROM recent;'), 'read');
    assert.equal(classifySql('PRAGMA table_info(notes)'), 'read');
});

test('允许一切单条写操作', () => {
    assert.equal(classifySql('INSERT INTO notes (content) VALUES (?)'), 'write');
    assert.equal(classifySql('UPDATE memories SET title = ?'), 'write');
    assert.equal(classifySql('DELETE FROM notes'), 'write');
    assert.equal(classifySql('CREATE TABLE x (id INTEGER PRIMARY KEY)'), 'write');
    assert.equal(classifySql('DROP TABLE notes'), 'write');
});

test('拒绝多语句', () => {
    assert.throws(() => classifySql('SELECT 1; DELETE FROM notes'), /一条 SQL/);
});
