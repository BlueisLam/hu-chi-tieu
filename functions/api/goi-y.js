// Hũ Chi Tiêu – gợi ý hôm nay ăn gì (Cloudflare Pages Function)
//
// Biến môi trường (Cloudflare → Pages → hu-chi-tieu → Settings → Variables and Secrets):
//   GEMINI_API_KEY          key Google AI Studio (có thể thêm GEMINI_API_KEY_2…_5 để chia tải)
//   GROQ_API_KEY            (không bắt buộc) dự phòng khi Gemini hết hạn mức
//   AI_PROVIDERS            thứ tự thử, mặc định "gemini,groq"
//   GEMINI_MODEL, GROQ_MODEL  đổi model khi Google/Groq khai tử model cũ
// Key chỉ nằm ở máy chủ, trình duyệt không bao giờ thấy.

const SB_URL_DEFAULT = 'https://aawhgpfmbkjytjuuygwa.supabase.co';
const SB_ANON_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhd2hncGZtYmtqeXRqdXV5Z3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDE3MjUsImV4cCI6MjEwODkxNzcyNX0.7JW812XdDPl4sUtiu1YqnSJKb1ce1FtfRRwX31JmN5s';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
const list = (v, n, m) => (Array.isArray(v) ? v : []).map(x => clip(x, m)).filter(Boolean).slice(0, n);
const num = (v, lo, hi, d) => { const x = Math.round(Number(v)); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };

function geminiKeys(env) {
  const raw = [env.GEMINI_API_KEY].concat(String(env.GEMINI_API_KEYS || '').split(/[\s,;]+/));
  for (let i = 1; i <= 5; i++) raw.push(env['GEMINI_API_KEY_' + i]);
  return raw.map(k => String(k || '').trim()).filter((k, i, a) => k.length >= 8 && a.indexOf(k) === i);
}
const providers = env => String(env.AI_PROVIDERS || 'gemini,groq').split(',').map(s => s.trim().toLowerCase())
  .filter((p, i, a) => a.indexOf(p) === i && (p === 'gemini' ? geminiKeys(env).length : p === 'groq' ? !!env.GROQ_API_KEY : false));

async function callGemini(env, prompt) {
  const models = [env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-flash-latest'].filter((m, i, a) => m && a.indexOf(m) === i);
  const keys = geminiKeys(env).sort(() => Math.random() - 0.5);
  let last = 'Gemini không phản hồi';
  for (const model of models) {
    let modelDead = false;
    for (const key of keys) {
      let r, raw;
      try {
        r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 4000, responseMimeType: 'application/json' } }),
          signal: AbortSignal.timeout(20000),
        });
        raw = await r.text();
      } catch (e) { last = 'Gemini: lỗi mạng hoặc quá giờ'; continue; }
      if (r.ok) {
        let c; try { c = (JSON.parse(raw).candidates || [])[0]; } catch { c = null; }
        const out = c && c.content && (c.content.parts || []).map(p => p.text || '').join('');
        if (out) return out;
        last = 'Gemini trả về rỗng'; continue;
      }
      last = 'Gemini ' + r.status + ': ' + raw.slice(0, 160);
      if (r.status === 404 || (r.status === 400 && /model/i.test(raw) && !/API[_ ]KEY/i.test(raw))) { modelDead = true; break; }
      // 429 hết hạn mức, 401/403 key sai, 5xx quá tải: thử key kế
    }
    if (!modelDead) break;
  }
  throw new Error(last);
}

async function callGroq(env, prompt) {
  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const body = { model, temperature: 0.9, max_completion_tokens: 2500, response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }] };
  if (/^openai\/gpt-oss/.test(model)) body.reasoning_effort = 'low';
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.GROQ_API_KEY },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const raw = await r.text();
  if (!r.ok) throw new Error('Groq ' + r.status + ': ' + raw.slice(0, 160));
  return String(((JSON.parse(raw).choices || [{}])[0].message || {}).content || '');
}

function extractJson(text) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('AI không trả JSON');
  return JSON.parse(s.slice(a, b + 1));
}

const CUI_CODE = { 'Việt': 'vn', 'Hàn': 'han', 'Nhật': 'nhat', 'Thái': 'thai', 'Trung': 'trung', 'Âu Mỹ': 'au', 'Khác': 'khac' };
const MEALS = { sang: 'bữa sáng', trua: 'bữa trưa', toi: 'bữa tối', vat: 'ăn vặt / đồ uống buổi chiều' };

function buildPrompt(q) {
  const lines = [
    'Bạn là người bạn sành ăn sống ở TP.HCM, giúp một người trẻ đi làm chọn món cho hợp túi tiền.',
    `Gợi ý đúng 3 lựa chọn cho ${MEALS[q.meal] || 'bữa ăn'} hôm nay (${q.today}), ${q.group === 'nhom' ? `đi ăn nhóm ${q.people} người bạn, mỗi người tự trả phần mình` : q.group === 'hai' ? 'đi ăn 2 người' : 'ăn một mình'}.`,
    ...(q.group === 'nhom' ? ['Ăn nhóm: ưu tiên quán ngồi được đông, món ăn chung vui (lẩu, nướng, ốc, gà rán, dimsum, pizza...), không gợi ý tự nấu; "gia" vẫn là giá mỗi người.'] : []),
    `Ngân sách cho bữa này: khoảng ${q.perMeal.toLocaleString('vi-VN')}đ mỗi người.`,
  ];
  if (q.recent.length) lines.push('Những món đã ăn gần đây, mới nhất trước: ' + q.recent.join('; ') + '.');
  if (q.likes) lines.push('Khẩu vị thích: ' + q.likes + '.');
  if (q.avoid) lines.push('Tuyệt đối không gợi ý món có: ' + q.avoid + '.');
  if (q.note) lines.push('Ghi chú thêm: ' + q.note + '.');
  if (q.exclude.length) lines.push('Đã gợi ý rồi, không lặp lại: ' + q.exclude.join(', ') + '.');
  if (q.stats) lines.push('Ẩm thực đã ăn 7 ngày qua (số bữa): ' + q.stats + '.');
  if (q.cuisine) lines.push('Người dùng muốn ăn: ' + q.cuisine + '. Cả 3 lựa chọn phải thuộc đúng loại này' + (/đồ nước/.test(q.cuisine) ? ' (món Việt có nước dùng: phở, bún, hủ tiếu, bánh canh, cháo, miến, lẩu...)' : /cơm, khô/.test(q.cuisine) ? ' (món Việt dạng cơm hoặc khô, không có nước dùng)' : '') + '.');
  else lines.push('Không chỉ định ẩm thực: dựa vào thống kê, nếu dạo này ăn lệch một kiểu thì gợi ý ít nhất một món thuộc ẩm thực khác (Hàn, Nhật, Thái, Trung, Âu Mỹ hoặc Việt kiểu khác).');
  if (q.good.length) lines.push('Món/quán người dùng đã chấm điểm cao (có thể gợi ý QUAY LẠI một quán phù hợp, khi đó ghi đúng tên quán vào "quan"): ' + q.good.join('; ') + '.');
  if (q.bad.length) lines.push('Món/quán bị chấm điểm thấp, KHÔNG gợi ý lại quán này và cân nhắc tránh kiểu món đó: ' + q.bad.join('; ') + '.');
  lines.push(
    '',
    'Quy tắc:',
    '- Món phổ biến, dễ mua ở TP.HCM, giá thực tế hiện nay; giá là cho 1 người, không vượt ngân sách quá 20%.',
    '- Không lặp món đã ăn trong 2 ngày gần nhất; nếu dạo này ăn nhiều một kiểu (nhiều đồ nước, nhiều đồ chiên, nhiều trà sữa) thì đổi vị.',
    '- Ba lựa chọn phải khác nhau rõ: ví dụ một món nước, một món cơm/khô, một lựa chọn nhẹ bụng hoặc tự nấu tiết kiệm.',
    '- "ly_do" viết tiếng Việt tự nhiên, tối đa 16 từ, nêu lý do cụ thể (đổi vị so với hôm qua, rẻ hơn ngân sách, ấm bụng buổi tối...).',
    '- "loi_khuyen": một câu ngắn tối đa 20 từ về chuyện ăn uống/chi tiêu dựa trên dữ liệu ở trên, giọng thân thiện, không phán xét.',
    '',
    'Chỉ trả về JSON đúng mẫu, không thêm chữ nào khác:',
    '{"goi_y":[{"ten":"Bún bò Huế","emoji":"🍜","gia":45000,"cach":"quán","quoc_gia":"Việt","quan":"","ly_do":"..."}],"loi_khuyen":"..."}',
    '"cach" là một trong: "quán", "giao hàng", "tự nấu". "quoc_gia" là một trong: "Việt", "Hàn", "Nhật", "Thái", "Trung", "Âu Mỹ", "Khác".',
    '"quan" chỉ điền khi gợi ý quay lại đúng một quán trong danh sách đã chấm điểm cao, còn lại để "". "emoji" là đúng một emoji món ăn.'
  );
  return lines.join('\n');
}

function shape(out) {
  const arr = Array.isArray(out && out.goi_y) ? out.goi_y : [];
  const items = arr.slice(0, 3).map(x => ({
    ten: clip(x.ten, 60), emoji: clip(x.emoji, 8) || '🍽️', gia: num(x.gia, 0, 2000000, 0),
    cach: ['quán', 'giao hàng', 'tự nấu'].includes(x.cach) ? x.cach : 'quán', ly_do: clip(x.ly_do, 140),
    cui: CUI_CODE[clip(x.quoc_gia, 20)] || '', quan: clip(x.quan, 60),
  })).filter(x => x.ten);
  if (!items.length) throw new Error('AI không đưa ra món nào');
  return { items, tip: clip(out.loi_khuyen, 160) };
}

export async function onRequestGet({ env }) {
  return json({ ai: providers(env).length > 0, providers: providers(env) });
}

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/.test(auth)) return json({ error: 'Cần đăng nhập để dùng gợi ý AI.' }, 401);
  const sbUrl = env.SUPABASE_URL || SB_URL_DEFAULT, sbKey = env.SUPABASE_ANON_KEY || SB_ANON_DEFAULT;
  try {
    const u = await fetch(sbUrl + '/auth/v1/user', { headers: { authorization: auth, apikey: sbKey }, signal: AbortSignal.timeout(8000) });
    if (!u.ok) return json({ error: 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.' }, 401);
  } catch { return json({ error: 'Không kiểm tra được đăng nhập, thử lại sau.' }, 503); }

  const order = providers(env);
  if (!order.length) return json({ error: 'Chưa gắn API key AI trên Cloudflare.', code: 'no_key' }, 503);

  let body; try { body = await request.json(); } catch { return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400); }
  const q = {
    meal: ['sang', 'trua', 'toi', 'vat'].includes(body.meal) ? body.meal : 'trua',
    people: num(body.people, 1, 12, 1),
    group: body.group === 'em' ? 'hai' : ['mot', 'hai', 'nhom'].includes(body.group) ? body.group : (num(body.people, 1, 12, 1) > 2 ? 'nhom' : num(body.people, 1, 12, 1) === 2 ? 'hai' : 'mot'),
    perMeal: num(body.perMeal, 10000, 1000000, 45000),
    today: clip(body.today, 40),
    recent: list(body.recent, 30, 60),
    exclude: list(body.exclude, 15, 60),
    likes: clip(body.likes, 200), avoid: clip(body.avoid, 200), note: clip(body.note, 200),
    cuisine: clip(body.cuisine, 40), stats: clip(body.cuisineStats, 200),
    good: list(body.good, 10, 160), bad: list(body.bad, 8, 160),
  };
  const prompt = buildPrompt(q);
  const errs = [];
  for (const p of order) {
    try {
      const text = p === 'gemini' ? await callGemini(env, prompt) : await callGroq(env, prompt);
      return json({ ...shape(extractJson(text)), provider: p });
    } catch (e) { errs.push(p + ': ' + (e && e.message || e)); }
  }
  return json({ error: 'AI đang bận hoặc hết hạn mức, thử lại sau ít phút.', detail: errs.join(' | ').slice(0, 400) }, 502);
}
