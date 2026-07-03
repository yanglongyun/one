// 鉴权头:兼容两类端点。
//   bearer    → Authorization: Bearer <key>(OpenAI 系)
//   x-api-key → x-api-key: <key>(Claude 系,如 /claude/ 端点)
export function authHeaders(mode, key) {
    return mode === 'x-api-key'
        ? { 'x-api-key': key }
        : { Authorization: `Bearer ${key}` };
}
