// OpenAI chat/completions 上游可选的两种密钥请求头。
//   bearer    → Authorization: Bearer <key>
//   x-api-key → x-api-key: <key>
export function authHeaders(mode, key) {
    return mode === 'x-api-key'
        ? { 'x-api-key': key }
        : { Authorization: `Bearer ${key}` };
}
