// 把 seeds/<slug>/ 各目录的源文件打包成 apps.sql(改完种子源码后跑:npm run seed:build)
// 插入顺序即面板顺序(服务端按 id ASC 列出):笔记 → 待办 → 恋爱 → 启示
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEEDS = dirname(fileURLToPath(import.meta.url));
const TS = 1783051262373;
const APPS = [
    { slug: 'notes', name: '笔记', icon: '📝', color: 'yellow', description: '随手记 —— 出厂自带的种子小应用' },
    { slug: 'todo', name: '待办', icon: '✅', color: 'green', description: '勾选清单 —— 出厂自带的种子小应用' },
    { slug: 'love', name: '恋爱', icon: '💕', color: 'pink', description: '虚拟恋人陪伴对话 —— 出厂自带的种子小应用' },
    { slug: 'insight', name: '启示', icon: '💡', color: 'orange', description: '每天一条 AI 给你的下一步建议' },
];
const FILES = ['index.html', 'index.css', 'index.js'];
const q = (s) => s.replace(/'/g, "''");

let out = '-- 出厂种子小应用(由 seeds/build.mjs 生成,勿手改;apps.id 自增,codes.app_id 用 slug 子查询定位)\n';
for (const a of APPS) {
    out += `INSERT INTO apps (slug,name,icon,color,description,created_at,updated_at) VALUES ('${a.slug}','${q(a.name)}','${a.icon}','${a.color}','${q(a.description)}',${TS},${TS});\n`;
    for (const f of FILES) {
        const content = readFileSync(join(SEEDS, a.slug, f), 'utf8');
        out += `INSERT INTO codes (app_id,filename,content,version,created_at) VALUES ((SELECT id FROM apps WHERE slug='${a.slug}'),'${f}','${q(content)}',1,${TS});\n`;
    }
}
writeFileSync(join(SEEDS, 'apps.sql'), out);
console.log(`apps.sql 已生成(${APPS.length} 个应用,${out.length} 字符)`);
