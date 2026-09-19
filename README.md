# PL Predictor — starter app

Web app dự đoán Premier League: auth qua email, dữ liệu trận đấu thật
(football-data.org), Match Predictor, Bot Predictor, pick %, leaderboard,
khóa dự đoán 8h trước kick-off. Không cần cron job — điểm số tính động
mỗi lần load leaderboard.

## Bước 1 — Tạo Supabase project (free)
1. Vào https://supabase.com → New project
2. Vào **SQL Editor** → dán nội dung file `supabase-schema.sql` → Run
3. Vào **Authentication → Providers** → bật **Email** (magic link, không cần password)
4. Vào **Authentication → URL Configuration** → thêm domain bạn sẽ deploy (ở bước 3) vào **Redirect URLs** (VD: `https://ten-app-cua-ban.vercel.app`)
5. Vào **Project Settings → API** → copy 3 giá trị: `Project URL`, `anon public key`, `service_role key`

## Bước 2 — Lấy API key dữ liệu bóng đá thật (free)
1. Đăng ký free tại https://www.football-data.org/client/register
2. Copy API key họ gửi qua email

## Bước 3 — Deploy lên Vercel (free, public URL thật)
1. Đẩy folder này lên một GitHub repo (repo riêng tư cũng được)
2. Vào https://vercel.com → New Project → import repo đó
3. Ở phần **Environment Variables**, thêm 4 biến (copy từ `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FOOTBALL_DATA_API_KEY`
4. Bấm Deploy — sau ~1 phút bạn có link dạng `https://ten-app.vercel.app`
5. Quay lại Supabase (bước 1.4) xác nhận domain Vercel đã có trong Redirect URLs

Xong bước này là bạn có **link public thật, ai cũng vào được, mời bạn bè
đăng ký bằng email là chơi được ngay.**

## Chạy thử ở máy local (không bắt buộc)
```bash
npm install
cp .env.example .env.local   # rồi điền 4 biến ở trên vào
npm run dev
```
Mở http://localhost:3000

## Cấu trúc chính
- `pages/login.js` — đăng nhập bằng email (magic link), không cần mật khẩu
- `pages/index.js` — toàn bộ UI: match predictor, bot vs bạn, leaderboard
- `pages/api/fixtures.js` — lấy lịch thi đấu thật
- `pages/api/predict.js` — nhận dự đoán, tự kiểm tra khóa 8h ở server (không tin client)
- `pages/api/leaderboard.js` — tính điểm on-the-fly, so với Bot
- `lib/botPredictor.js` — logic Bot dự đoán, đổi công thức ở đây là nâng cấp Bot cho cả app
- `supabase-schema.sql` — 2 bảng: `profiles`, `predictions`, có Row Level Security (mỗi người chỉ sửa được dự đoán của chính mình, nhưng ai cũng xem được — đây là phần chặn giả tên/sửa điểm người khác)

## Việc cần làm tiếp (chưa có trong bản này)
- Fantasy Player Optimiser (tính năng phức tạp nhất, nên làm sau khi 3 tính năng kia chạy ổn)
- Group Stage Tracker dạng bảng xếp hạng đẹp hơn (hiện leaderboard đã có, bảng PL đầy đủ có thể lấy thêm từ `football-data.org` endpoint `/v4/competitions/PL/standings`)
- Trang profile xem lại lịch sử dự đoán của riêng mình
