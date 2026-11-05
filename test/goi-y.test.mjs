// Chạy: node test/goi-y.test.mjs  (giả lập Supabase + Gemini + Groq, không gọi mạng thật)
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../functions/api/goi-y.js';

const calls = [];
let geminiPlan = [];   // danh sách phản hồi giả cho mỗi lần gọi Gemini
const AI_OK = { goi_y: [
  { ten: 'Bún bò Huế', emoji: '🍜', gia: 45000, cach: 'quán', quoc_gia: 'Việt', quan: 'Bà Năm', ly_do: 'Đổi vị sau hai hôm ăn cơm' },
  { ten: 'Cơm gà xối mỡ', emoji: '🍗', gia: 40000, cach: 'giao hàng', ly_do: 'Rẻ hơn ngân sách' },
  { ten: 'Salad ức gà', emoji: '🥗', gia: 50000, cach: 'tự nấu', ly_do: 'Nhẹ bụng' },
  { ten: 'Thừa', emoji: '🍕', gia: 1, cach: 'x', ly_do: '' }], loi_khuyen: 'Tuần này trà sữa hơi nhiều nha.' };
const res = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
globalThis.fetch = async (url, init = {}) => {
  url = String(url); calls.push(url);
  if (url.includes('/auth/v1/user')) return init.headers.authorization === 'Bearer good' ? res(200, { id: 'u1' }) : res(401, {});
  if (url.includes('generativelanguage')) {
    const next = geminiPlan.shift() || [200, { candidates: [{ content: { parts: [{ text: JSON.stringify(AI_OK) }] } }] }];
    return res(next[0], next[1]);
  }
  if (url.includes('api.groq.com')) return res(200, { choices: [{ message: { content: '```json\n' + JSON.stringify(AI_OK) + '\n```' } }] });
  throw new Error('unexpected ' + url);
};
const req = (auth, body) => new Request('https://x/api/goi-y', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) });
const B = { meal: 'trua', people: 2, perMeal: 45000, today: 'Thứ 5, 5/11', recent: ['Cơm tấm', 'Phở'], likes: 'cay', avoid: 'hành', exclude: ['Bún riêu'],
  cuisine: 'Việt · đồ nước', cuisineStats: 'Việt 8 (đồ nước 5), Hàn 1', good: ['Bún bò – Bà Năm (Việt) 9/10: nước đậm'], bad: ['Cơm gà – Quán X (Việt) 3/10'] };
let n = 0; const ok = (name) => console.log('✓', ++n, name);

// 1. chưa có key
let r = await onRequestGet({ env: {} }); assert.equal((await r.json()).ai, false); ok('GET báo chưa có key');
r = await onRequestGet({ env: { GEMINI_API_KEY: 'k'.repeat(20) } }); assert.deepEqual((await r.json()).providers, ['gemini']); ok('GET báo có Gemini');

// 2. chưa đăng nhập / token sai
r = await onRequestPost({ request: req(null, B), env: { GEMINI_API_KEY: 'k'.repeat(20) } }); assert.equal(r.status, 401); ok('Không có token → 401');
r = await onRequestPost({ request: req('Bearer bad', B), env: { GEMINI_API_KEY: 'k'.repeat(20) } }); assert.equal(r.status, 401); ok('Token sai → 401');

// 3. đăng nhập nhưng chưa gắn key
r = await onRequestPost({ request: req('Bearer good', B), env: {} }); assert.equal(r.status, 503); assert.equal((await r.json()).code, 'no_key'); ok('Chưa gắn key → 503 no_key');

// 4. thành công, cắt còn 3 món, chuẩn hoá
r = await onRequestPost({ request: req('Bearer good', B), env: { GEMINI_API_KEY: 'k'.repeat(20) } });
let d = await r.json(); assert.equal(r.status, 200); assert.equal(d.items.length, 3); assert.equal(d.provider, 'gemini');
assert.equal(d.items[0].ten, 'Bún bò Huế'); assert.equal(d.items[1].cach, 'giao hàng'); assert.ok(d.tip);
assert.equal(d.items[0].quan, 'Bà Năm'); assert.equal(d.items[0].cui, 'vn'); assert.equal(d.items[1].cui, ''); ok('Gemini trả 3 món, có quán + ẩm thực');

// 5. model bị khai tử (404) → model kế; key hết hạn mức (429) → key kế
calls.length = 0;
geminiPlan = [[404, 'model not found'], [429, 'RESOURCE_EXHAUSTED quota'], [200, { candidates: [{ content: { parts: [{ text: JSON.stringify(AI_OK) }] } }] }]];
r = await onRequestPost({ request: req('Bearer good', B), env: { GEMINI_API_KEY: 'a'.repeat(20), GEMINI_API_KEY_2: 'b'.repeat(20) } });
assert.equal(r.status, 200); assert.equal(calls.filter(u => u.includes('generativelanguage')).length, 3);
assert.ok(calls.some(u => u.includes('gemini-flash-latest'))); ok('404 đổi model, 429 đổi key');

// 6. Gemini hỏng hết → Groq dự phòng (bóc ```json)
geminiPlan = [[500, 'x'], [500, 'x'], [500, 'x'], [500, 'x']];
r = await onRequestPost({ request: req('Bearer good', B), env: { GEMINI_API_KEY: 'a'.repeat(20), GROQ_API_KEY: 'g'.repeat(20) } });
d = await r.json(); assert.equal(r.status, 200); assert.equal(d.provider, 'groq'); ok('Gemini lỗi → Groq');

// 7. Mọi nhà đều lỗi → 502 có thông báo tiếng Việt
geminiPlan = [[500, 'x'], [500, 'x'], [500, 'x'], [500, 'x']];
r = await onRequestPost({ request: req('Bearer good', B), env: { GEMINI_API_KEY: 'a'.repeat(20) } });
assert.equal(r.status, 502); assert.match((await r.json()).error, /AI đang bận/); ok('Hết đường → 502');

// 8. Prompt có đủ ngữ cảnh, dữ liệu rác bị cắt
let sent = '';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { if (String(url).includes('generativelanguage')) sent = JSON.parse(init.body).contents[0].parts[0].text; return realFetch(url, init); };
await onRequestPost({ request: req('Bearer good', { ...B, perMeal: 999999999, recent: Array(100).fill('Cơm tấm') }), env: { GEMINI_API_KEY: 'k'.repeat(20) } });
assert.match(sent, /2 người/); assert.match(sent, /không gợi ý món có: hành/); assert.match(sent, /Bún riêu/); assert.match(sent, /1\.000\.000đ/);
assert.equal((sent.match(/Cơm tấm/g) || []).length, 30);
assert.match(sent, /muốn ăn: Việt · đồ nước/); assert.match(sent, /món Việt có nước dùng/); assert.match(sent, /Bà Năm\) 9\/10|Bà Năm \(Việt\) 9\/10/);
assert.match(sent, /KHÔNG gợi ý lại quán này.*Quán X/); assert.match(sent, /Việt 8 \(đồ nước 5\)/); ok('Prompt đủ ngữ cảnh, ẩm thực, điểm quán');
// 11. Ăn nhóm
sent='';
await onRequestPost({ request: req('Bearer good', { ...B, group: 'nhom', people: 5 }), env: { GEMINI_API_KEY: 'k'.repeat(20) } });
assert.match(sent, /đi ăn nhóm 5 người bạn/); assert.match(sent, /không gợi ý tự nấu/); ok('Prompt ăn nhóm');
console.log('Tất cả', n, 'test đạt');
