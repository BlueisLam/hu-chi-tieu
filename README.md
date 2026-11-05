# Hũ Chi Tiêu

Sổ chi tiêu cá nhân dạng web app (PWA) giao diện pastel. Dùng tốt trên iPhone, cài được ra màn hình chính; mở trên máy tính thì có giao diện rộng.

- Ghi chi tiêu bằng câu tự nhiên: `cafe 45k`, `grab 32k ck hôm qua`, `shopee 1tr2 ck`
- Báo cáo theo tuần, tháng, năm, so sánh với kỳ trước
- Ngân sách theo danh mục (cảnh báo ở 80% và 100%), khoản định kỳ, hũ tiết kiệm, sổ cho mượn / đi vay
- Đồng bộ qua Supabase, ghi được khi mất mạng, khoá bằng Face ID

Không cần build: toàn bộ app nằm trong `index.html`.

## Cấu trúc

```
index.html             app
manifest.webmanifest   cài lên màn hình chính
sw.js                  service worker (mở được khi mất mạng)
icon-*.png             icon
_headers               header cho Cloudflare Pages
supabase/schema.sql    tạo bảng + phân quyền trên Supabase
```

## Cài đặt từ đầu

### 1. Supabase (đã cài sẵn)

App dùng chung project **luna-cosmetics**, mọi bảng đều có tiền tố `hct_` nên không đụng dữ liệu shop. URL và anon key đã điền sẵn trong `CONFIG` ở đầu phần script của `index.html`. Anon key được phép công khai, vì dữ liệu đã được bảo vệ bằng Row Level Security: mỗi tài khoản chỉ đọc và ghi được dữ liệu của chính mình.

Muốn dựng lại trên project khác: chạy `supabase/schema.sql` trong SQL Editor, rồi đổi `CONFIG`.

**Tạo tài khoản đăng nhập:** project đang tắt đăng ký công khai (để bảo vệ shop), nên tạo tài khoản trong dashboard:
Authentication → Users → **Add user → Create new user** → nhập email và mật khẩu → tick **Auto Confirm User** → Create.

### 2. Cloudflare Pages (tự deploy mỗi lần push)

Project Cloudflare Pages `hu-chi-tieu` đã được nối với repo này: không có build command, thư mục xuất là gốc repo. Mỗi lần push lên `main`, Cloudflare tự deploy lại sau khoảng 30 giây.

### 3. Đăng nhập

Mở link Cloudflare (`*.pages.dev`) → **Đăng nhập** bằng email và mật khẩu vừa tạo. Dữ liệu tự đồng bộ giữa các máy.
"Quên mật khẩu?" sẽ gửi link đặt lại tới email, nhớ mở link đó trên cùng máy.

### 4. iPhone

1. Mở link Cloudflare (`*.pages.dev`) bằng **Safari** → **Chia sẻ → Thêm vào MH chính**.
2. Mở app từ icon → đăng nhập bằng email + mật khẩu → **Cài đặt → Khoá bằng Face ID**.
3. Back Tap: app **Phím tắt** → tạo phím tắt **Mở URL** `https://<site>.pages.dev/#nhap` → **Cài đặt → Trợ năng → Cảm ứng → Chạm vào mặt sau → Chạm hai lần** → chọn phím tắt đó.
   Phím tắt sẽ mở Safari, nên cần đăng nhập trong Safari một lần nữa.

## Cách gõ

| Gõ | Hiểu là |
|---|---|
| `cafe 45k` | 45.000đ · Ăn uống · hôm nay · tiền mặt |
| `grab 32k ck hôm qua` | 32.000đ · Di chuyển · hôm qua · chuyển khoản |
| `gửi mẹ 2tr 3/11` | 2.000.000đ · Gia đình · ngày 3/11 |
| `trà sữa 38` | 38.000đ (số không đơn vị được hiểu là nghìn) |
| `cơm 45k cho Thái` | 45.000đ · Ăn uống · chi cho Thái |
| `đi chợ 300k chung` | 300.000đ · Ăn uống · chung cả nhà |

**Chi cho ai:** mỗi khoản được gắn nhãn Mình / Thái / Chung, nhưng vẫn tính đủ vào tổng chi. Tổng quan và Báo cáo có thanh tách theo người, hũ có thể lọc theo người. Đổi tên hoặc thêm người trong Cài đặt → Người trong nhà.

Nếu app đoán sai danh mục, chọn lại một lần, lần sau app sẽ tự xếp đúng.

## Gợi ý "Hôm nay ăn gì?" bằng AI

Thẻ ở Tổng quan luôn có 3 gợi ý nhanh chạy ngay trên máy (theo bữa, ngân sách Ăn uống còn lại, món đã ăn 4 ngày gần đây và khẩu vị trong Cài đặt). Bấm **✨ Hỏi AI** để được gợi ý kỹ hơn.

API key chỉ nằm trên máy chủ Cloudflare (`functions/api/goi-y.js`), không nằm trong code và trình duyệt không thấy. Chỉ người đã đăng nhập mới gọi được.

**Gắn key:** Cloudflare → Workers & Pages → `hu-chi-tieu` → Settings → Variables and Secrets → Add:
- `GEMINI_API_KEY` (loại **Secret**): lấy miễn phí ở https://aistudio.google.com/apikey
- Không bắt buộc: `GROQ_API_KEY` làm dự phòng; `GEMINI_MODEL` / `GROQ_MODEL` khi model cũ bị khai tử; thêm `GEMINI_API_KEY_2`… để chia tải.

Sau khi thêm biến: Deployments → bản mới nhất → **Retry deployment** thì key mới có hiệu lực.

**Ăn với ai:** Một mình / 2 người (ghi tiền cả 2 phần, sửa lại nếu chia đôi) / Nhóm 3–12 người (mỗi người tự trả, ghi phần của mình, ưu tiên món ăn chung).

**Ẩm thực:** Tự chọn (app tự đổi vị khi dạo này ăn lệch một kiểu) · Việt đồ nước · Việt cơm/khô · Hàn · Nhật · Thái · Trung · Âu Mỹ. Thẻ hiện thống kê 7 ngày, Báo cáo có thẻ "Ăn theo ẩm thực".

**Chấm điểm quán:** gõ `bún bò 50k @Bà Năm` để ghi tên quán. Ăn xong, Tổng quan hỏi "ngon không?", hoặc bấm vào khoản chi → Chấm điểm quán (1–10, ẩm thực, nhận xét). Báo cáo có "Sổ tay quán ăn". AI dùng quán ≥ 8 điểm để gợi ý quay lại và tránh quán ≤ 5 điểm. Điểm lưu trong `hct_settings.data.reviews` nên không cần thêm cột Supabase.

Test hàm máy chủ (giả lập, không gọi mạng): `node test/goi-y.test.mjs`

## Phát triển tiếp

- Sửa `index.html` → commit → push → Cloudflare tự deploy.
- **Mỗi lần sửa, tăng `APP_VERSION`** ở đầu phần script của `index.html` (vd `2026.11.05-3`). App trên điện thoại tự so phiên bản khi mở lại và hiện thanh “Có bản mới”. Nút ↻ trên thanh đầu trang (bản điện thoại) và Cài đặt → Tải bản mới sẽ xoá bộ nhớ đệm rồi tải lại.
- Khi đổi `sw.js`, tăng `CACHE = 'hct-vN'`.
- Ý tưởng: đọc biến động số dư qua Casso/SePay (webhook → Supabase Edge Function), quản lý thu nhập, chia tiền nhóm.
