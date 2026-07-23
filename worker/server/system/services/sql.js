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

function mainStatement(words) {
    if (words[0] !== 'with') return words[0];
    let depth = 0;
    for (let index = 1; index < words.length; index++) {
        if (words[index] === '(') depth++;
        else if (words[index] === ')') depth--;
        else if (depth === 0 && ['select', 'insert', 'replace', 'update', 'delete'].includes(words[index])) {
            return words[index];
        }
    }
    throw new Error('无效 WITH 语句');
}

// sql 工具只读:系统表一律经 one_manage 的正式业务接口写。
export function classifySql(query) {
    const words = tokens(query);
    const semicolons = words.reduce((count, word) => count + (word === ';' ? 1 : 0), 0);
    if (semicolons > 1 || (semicolons === 1 && words.at(-1) !== ';')) throw new Error('每次只能执行一条 SQL');
    if (words.at(-1) === ';') words.pop();
    if (mainStatement(words) !== 'select') throw new Error('sql 只支持 SELECT 查询,写入走 one_manage');
    return 'read';
}

export async function executeSql(db, query, params = []) {
    const text = String(query || '').trim();
    if (!text) throw new Error('空查询');
    classifySql(text);
    const { results } = await db.prepare(text).bind(...(Array.isArray(params) ? params : [])).all();
    return { rows: results, count: results.length };
}
