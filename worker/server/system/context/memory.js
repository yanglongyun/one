import { promptContext } from '../../apps/memories/repository.js';

export async function memoryPrompt(db) {
    if (!db) return '';
    const { must, star, storedCount } = await promptContext(db);
    const promptLines = ['## 记忆'];
    if (must.length) {
        promptLines.push('下面是必须阅读的长期记忆,把它们作为重要用户上下文。');
        for (const memory of must) {
            promptLines.push(`### must #${memory.id}: ${memory.title}`);
            if (memory.description) promptLines.push(`描述:${memory.description}`);
            if (memory.body) promptLines.push(memory.body);
        }
    } else {
        promptLines.push('必读记忆:无。');
    }
    if (star.length) {
        promptLines.push('星标记忆摘要:');
        for (const memory of star) promptLines.push(`- star #${memory.id}: ${memory.title}${memory.description ? ` - ${memory.description}` : ''}`);
    } else {
        promptLines.push('星标记忆:无。');
    }
    promptLines.push(`普通记忆数量:${storedCount}。`);
    promptLines.push('搜索或读取记忆时用 sql;新增、更新、删除记忆时用 one_manage,visibility 只能是 must/star/stored。');
    return promptLines.join('\n');
}
