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
netlify.toml           cấu hình Netlify
supabase/schema.sql    tạo bảng + phân quyền trên Supabase
```

## Cài đặt từ đầu

### 1. Supabase

1. https://supabase.com → **New project** (region Singapore).
2. **SQL Editor** → dán toàn bộ `supabase/schema.sql` → **Run**.
3. **Authentication → Email Templates → Magic Link**, thay nội dung bằng:
   ```html
   <h2>Mã đăng nhập Hũ Chi Tiêu</h2>
   <p>Mã của bạn: <b style="font-size:24px">{{ .Token }}</b></p>
   ```
   App đăng nhập bằng mã 6 số thay vì link, vì trên iPhone, app ở màn hình chính không dùng chung đăng nhập với Safari.
4. **Project Settings → API**: chép **Project URL** và **anon public key**.

### 2. Netlify (tự deploy mỗi lần push)

1. https://app.netlify.com → **Add new site → Import an existing project → GitHub** → chọn repo `hu-chi-tieu`.
2. Để trống Build command; **Publish directory** để `.` → **Deploy**.
3. **Site configuration → Change site name** → ví dụ `hu-chi-tieu-lam`.
4. Quay lại Supabase → **Authentication → URL Configuration** → điền link Netlify vào **Site URL**.

Từ giờ, mỗi lần push lên nhánh `main`, Netlify tự deploy lại.

### 3. Gắn Supabase vào app

Cách 1: mở app → **Cài đặt → Kết nối cloud** → dán URL và key. Phải làm riêng trên từng máy hoặc trình duyệt.

Cách 2 (khuyên dùng): điền một lần vào `index.html`, rồi commit và push:
```js
const CONFIG = { SUPABASE_URL: 'https://xxxx.supabase.co', SUPABASE_ANON_KEY: 'eyJ...' };
```
Anon key được phép công khai, vì dữ liệu đã được bảo vệ bằng Row Level Security trong `schema.sql`: mỗi tài khoản chỉ đọc và ghi được dữ liệu của chính mình.

### 4. iPhone

1. Mở link Netlify bằng **Safari** → **Chia sẻ → Thêm vào MH chính**.
2. Mở app từ icon → đăng nhập bằng mã email → **Cài đặt → Khoá bằng Face ID**.
3. Back Tap: app **Phím tắt** → tạo phím tắt **Mở URL** `https://<site>.netlify.app/#nhap` → **Cài đặt → Trợ năng → Cảm ứng → Chạm vào mặt sau → Chạm hai lần** → chọn phím tắt đó.
   Phím tắt sẽ mở Safari, nên cần đăng nhập trong Safari một lần nữa.

## Cách gõ

| Gõ | Hiểu là |
|---|---|
| `cafe 45k` | 45.000đ · Ăn uống · hôm nay · tiền mặt |
| `grab 32k ck hôm qua` | 32.000đ · Di chuyển · hôm qua · chuyển khoản |
| `gửi mẹ 2tr 3/11` | 2.000.000đ · Gia đình · ngày 3/11 |
| `trà sữa 38` | 38.000đ (số không đơn vị được hiểu là nghìn) |

Nếu app đoán sai danh mục, chọn lại một lần, lần sau app sẽ tự xếp đúng.

## Phát triển tiếp

- Sửa `index.html` → commit → push → Netlify tự deploy.
- Khi đổi `sw.js`, tăng `CACHE = 'hct-vN'` để máy người dùng nhận bản mới.
- Ý tưởng: đọc biến động số dư qua Casso/SePay (webhook → Supabase Edge Function), quản lý thu nhập, chia tiền nhóm.
