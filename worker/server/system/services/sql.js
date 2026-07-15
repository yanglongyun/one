function tokens(sql) {
    const out = [];
    let index = 0;
    while (index < sql.length) {
        const char = sql[index];
        if (/\s/.test(char)) { index++; continue; }
        if (char === '-' && sql[index + 1] === '-') {
            index = sql.indexOf('\n', index + 2);
            if (index < 0) break;
            continue;
        }
        if (char === '/' && sql[index + 1] === '*') {
            const end = sql.indexOf('*/', index + 2);
            if (end < 0) throw new Error('SQL 注释未结束');
            index = end + 2;
            continue;
        }
        if (char === "'") {
            index++;
            while (index < sql.length) {
                if (sql[index] === "'" && sql[index + 1] === "'") { index += 2; continue; }
                if (sql[index++] === "'") break;
            }
            continue;
        }
        if (char === '"' || char === '`' || char === '[') {
            const close = char === '[' ? ']' : char;
            let value = '';
            index++;
            while (index < sql.length && sql[index] !== close) value += sql[index++];
            if (sql[index] !== close) throw new Error('SQL 标识符未结束');
            index++;
            out.push(value.toLowerCase());
            continue;
        }
        const word = sql.slice(index).match(/^[a-z_][a-z0-9_$]*/i);
        if (word) {
            out.push(word[0].toLowerCase());
            index += word[0].length;
            continue;
        }
        out.push(char);
        index++;
    }
    return out;
}

function skip(words, index, sequence) {
    for (const word of sequence) if (words[index] === word) index++;
    return index;
}

function mainStatement(words) {
    if (words[0] !== 'with') return { keyword: words[0], index: 0 };
    let depth = 0;
    for (let index = 1; index < words.length; index++) {
        if (words[index] === '(') depth++;
        else if (words[index] === ')') depth--;
        else if (depth === 0 && ['select', 'insert', 'replace', 'update', 'delete'].includes(words[index])) {
            return { keyword: words[index], index };
        }
    }
    throw new Error('无效 WITH 语句');
}

function mutationTarget(words, statement) {
    let index = statement.index + 1;
    if (statement.keyword === 'insert') {
        if (words[index] === 'or') index += 2;
        if (words[index] !== 'into') throw new Error('只支持标准 INSERT INTO');
        return words[index + 1];
    }
    if (statement.keyword === 'replace') {
        if (words[index] === 'into') index++;
        return words[index];
    }
    if (statement.keyword === 'update') {
        if (words[index] === 'or') index += 2;
        return words[index];
    }
    if (statement.keyword === 'delete') {
        if (words[index] !== 'from') throw new Error('只支持标准 DELETE FROM');
        return words[index + 1];
    }
    if (statement.keyword === 'alter') {
        if (words[index] !== 'table') throw new Error('只允许 ALTER TABLE');
        return words[index + 1];
    }
    if (statement.keyword === 'drop') {
        if (words[index] !== 'table') throw new Error('只允许 DROP TABLE');
        index = skip(words, index + 1, ['if', 'exists']);
        return words[index];
    }
    if (statement.keyword === 'create') {
        if (words[index] === 'unique') index++;
        if (words[index] === 'table') {
            index = skip(words, index + 1, ['if', 'not', 'exists']);
            return words[index];
        }
        if (words[index] === 'index') {
            index = skip(words, index + 1, ['if', 'not', 'exists']);
            index++;
            if (words[index] !== 'on') throw new Error('无效 CREATE INDEX');
            return words[index + 1];
        }
        throw new Error('只允许创建 app_* 表和索引');
    }
    throw new Error('不支持的 SQL 写操作');
}

export function classifySql(query) {
    const words = tokens(query);
    const semicolons = words.reduce((count, word) => count + (word === ';' ? 1 : 0), 0);
    if (semicolons > 1 || (semicolons === 1 && words.at(-1) !== ';')) throw new Error('每次只能执行一条 SQL');
    if (words.at(-1) === ';') words.pop();
    const statement = mainStatement(words);
    if (statement.keyword === 'select') return 'read';
    const target = mutationTarget(words, statement);
    if (!target?.startsWith('app_')) throw new Error('SQL 写操作只允许 app_* 小应用数据表');
    for (let index = 0; index < words.length; index++) {
        if (words[index] === 'references' && !words[index + 1]?.startsWith('app_')) {
            throw new Error('小应用外键只能引用 app_* 数据表');
        }
    }
    return 'write';
}

export async function executeSql(db, query, params = []) {
    const text = String(query || '').trim();
    if (!text) throw new Error('空查询');
    const mode = classifySql(text);
    const statement = db.prepare(text).bind(...(Array.isArray(params) ? params : []));
    if (mode === 'read') {
        const { results } = await statement.all();
        return { rows: results, count: results.length };
    }
    const result = await statement.run();
    return {
        ok: true,
        changes: result.meta?.changes ?? 0,
        lastRowId: Number(result.meta?.last_row_id) || 0,
    };
}
