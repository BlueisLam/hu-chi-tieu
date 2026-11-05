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

### 1. Supabase (đã cài sẵn)

App dùng chung project **luna-cosmetics**, mọi bảng đều có tiền tố `hct_` nên không đụng dữ liệu shop. URL và anon key đã điền sẵn trong `CONFIG` ở đầu phần script của `index.html`. Anon key được phép công khai, vì dữ liệu đã được bảo vệ bằng Row Level Security: mỗi tài khoản chỉ đọc và ghi được dữ liệu của chính mình.

Muốn dựng lại trên project khác: chạy `supabase/schema.sql` trong SQL Editor, rồi đổi `CONFIG`.

**Tạo tài khoản đăng nhập:** project đang tắt đăng ký công khai (để bảo vệ shop), nên tạo tài khoản trong dashboard:
Authentication → Users → **Add user → Create new user** → nhập email và mật khẩu → tick **Auto Confirm User** → Create.

### 2. Netlify (tự deploy mỗi lần push)

Site đã được nối với repo này. Mỗi lần push lên `main`, Netlify tự deploy lại sau khoảng 30 giây.

### 3. Đăng nhập

Mở link Netlify → **Đăng nhập** bằng email và mật khẩu vừa tạo. Dữ liệu tự đồng bộ giữa các máy.
"Quên mật khẩu?" sẽ gửi link đặt lại tới email, nhớ mở link đó trên cùng máy.

### 4. iPhone

1. Mở link Netlify bằng **Safari** → **Chia sẻ → Thêm vào MH chính**.
2. Mở app từ icon → đăng nhập bằng email + mật khẩu → **Cài đặt → Khoá bằng Face ID**.
3. Back Tap: app **Phím tắt** → tạo phím tắt **Mở URL** `https://<site>.netlify.app/#nhap` → **Cài đặt → Trợ năng → Cảm ứng → Chạm vào mặt sau → Chạm hai lần** → chọn phím tắt đó.
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

## Phát triển tiếp

- Sửa `index.html` → commit → push → Netlify tự deploy.
- Khi đổi `sw.js`, tăng `CACHE = 'hct-vN'` để máy người dùng nhận bản mới.
- Ý tưởng: đọc biến động số dư qua Casso/SePay (webhook → Supabase Edge Function), quản lý thu nhập, chia tiền nhóm.
