# Handoff: sequence. — Presentation redesign (Direction 1a "Editorial")

> Typography update, 08/10/2026: the user requires sans-serif typography. IBM Plex Sans replaces Newsreader for all headings, large numerals, captions and the wordmark. This supersedes the serif typography specifications below; colors and structure remain as implemented.

> Product update, 08/10/2026: the user removed the standalone “Dự báo hôm nay” chapter. The current sequence is Shopee Thailand → FPT → Tổng kết → 04 Hỏi đáp, plus Phụ lục. Legacy forecast links redirect to chat. The original handoff below remains a visual reference; its daily screen, five-chapter numbering, and related navigation are superseded. Forecast services remain available to the chatbot.

## Overview
A redesign of the `sequence.` RNN teaching site (`website/` Vite + React + TS app) for **live, projected presentation** by a lecturer. The separate screens of today's site (`#demo`, Tổng kết, `#fpt-daily`, `#chat`, `#explore-*`) are merged into **one linear talk** with a single chapter bar:

`01 Shopee Thailand → 02 FPT → 03 Tổng kết → 04 Dự báo hôm nay → 05 Hỏi đáp` + `Phụ lục` (appendix, off the main path).

The visual direction is "Editorial": warm paper, black ink, one vermilion accent, hairline rules instead of cards, serif numerals large enough to read from the back of a room. All copy is Vietnamese only.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the intended look and behaviour, not production code to copy. The task is to **recreate this design inside the existing `website/` codebase** (React 19 + TypeScript + plain CSS files per component, lucide-react icons), reusing its existing hooks, domain logic and data loading. Do not ship the `.dc.html` files.

The prototype re-implements a few pieces of existing domain logic in `sequence-data.js` for convenience; in the real app keep using the originals:
- `src/domain/demo/replayTimeline.ts` (frame → phase, frame durations)
- `src/domain/demo/stateHandover.ts` (`getHandoverPhase`, `getTransferPosition`)
- `src/domain/demo/demoCopy.ts` (`DATASET_COPY`, `PHASE_LABELS`, `getCaption`, `compareText`, `stateColor`)
- `src/domain/demo/inputReadout.ts`, `src/hooks/useDemoData.ts`, `src/hooks/useDemoPlayback.ts`
- Data: `public/data/demo.json`, `fpt-daily.json`, `fpt-outlook.json`, `shopee.json`, `fpt.json`

## Fidelity
**High-fidelity.** Colours, type, spacing and interactions are final. Recreate pixel-accurately at the 1600×900 design size; the whole stage scales uniformly to the viewport (see Responsive).

## Global layout & chrome

### Stage
- Fixed design canvas **1600 × 900 px**, background `#F6F4EF`, scaled with `transform: scale(min(vw/1600, vh/900))`, centred (letterbox fills with `#F6F4EF`). `body { overflow: hidden }`.
- Every screen: CSS grid, first row **76px** chapter bar, rest content.

### Chapter bar (replaces `DemoHeader` + `DatasetNavigation` + header buttons)
- Height 76px, `padding: 0 40px`, `border-bottom: 1px solid #161512`, flex, items stretch.
- **Wordmark**: "sequence" + "." in `#D2462A`; Newsreader 600 30px, letter-spacing −0.03em; `padding-right: 36px; border-right: 1px solid #D9D4C8`. (Replaces Layers3 icon + text.)
- **Chapters** (5 items, flex row): each `padding: 0 22px; border-right: 1px solid #D9D4C8`; gap 12px between number and label.
  - Number: IBM Plex Mono 500 14px. Shows `✓` for completed chapters.
  - Label: IBM Plex Sans 500 17px / 1.2.
  - Colours: current `#161512`; completed `#5E5A52`; upcoming `#A39D90`.
  - Current indicator: `box-shadow: inset 0 -4px 0 #D2462A` (4px bottom bar).
  - Chapters 01/02 additionally show 4 phase ticks under the label: each 18×3px, gap 3px; colour `#D2462A` for phases ≤ current phase, `#D9D4C8` otherwise, `#5E5A52` when chapter completed.
  - Labels: `Shopee Thailand`, `FPT`, `Tổng kết`, `Dự báo hôm nay`, `Hỏi đáp`.
- **Right side**: `Phụ lục` (500 16px; current state = same 4px accent bottom bar), on demo screen also `book-open` (Giải thích nhanh) and `maximize-2` (fullscreen) lucide icons, 22px, stroke 1.8, `#161512`, gap 22px.

### Eyebrow + title pattern (all screens)
- Eyebrow: IBM Plex Mono 500 14px, letter-spacing .04em, uppercase, `#D2462A`. Format `NN — TOPIC · SUBTOPIC`.
- Title (h2): Newsreader 500, 50–52px (68px on Tổng kết), line-height 1.08, letter-spacing −0.025em, `#161512`.

### Chapter footer (screens 03 and 04)
- `margin: 0 48px; padding: 16–18px 0 20–22px; border-top: 1px solid #161512`; grid `auto 1fr auto`, gap 30px.
- Left: back link — `arrow-left` 20px stroke 1.8 + label, 16px `#5E5A52`.
- Middle: narration line, Newsreader 400 23px `#161512`.
- Right: next button — height 54px, `padding: 0 22px`, bg `#D2462A`, text `#fff` 500 18px, `arrow-right` 20px; square corners.

## Screens

### 1. Trình diễn (Demo stage) — chapters 01 Shopee / 02 FPT
Replaces `DemoStage` (`DemoHeading`, `ReplayChart`, `PhasePanel`, `RecurrentMechanism`, `StateHandover`, `PlaybackControls`).

`main`: `padding: 22px 48px 0`, grid rows `auto | 1fr | auto | auto`.

**a. Heading row** — grid `1fr auto`, align end, gap 24px, `padding-bottom: 18px`.
- Eyebrow: `01 — SHOPEE THAILAND · HÀNH VI KHÁCH HÀNG · MÔ PHỎNG` / `02 — FPT · CHỨNG KHOÁN` (= `DATASET_COPY[id].subject` upper-cased).
- Title: `DATASET_COPY[id].question`.
- Right column (flex column, align end, gap 12px):
  - Phase stepper: `<ol>` with `border: 1px solid #161512`; each item `padding: 9px 16px; border-right: 1px solid #D9D4C8`, gap 10px; number Mono 500 14px (✓ when done), label 500 16px. Current: bg `#161512`, text `#F6F4EF`. Done: `#161512`. Upcoming: `#A39D90`. Labels = `PHASE_LABELS`.
  - `inputDescription` 15px `#5E5A52`, right-aligned, max-width 560px.

**b. Observation row** — grid `1fr 440px`; `border-top: 1px solid #161512; border-bottom: 1px solid #D9D4C8`.
- Chart column `padding: 14px 28px 10px 0`, flex column gap 6px.
  - Label row: chart label (`Số đơn hàng mỗi ngày` / `Giá đóng cửa`) + unit in Mono, 15px `#5E5A52`.
  - Chart **1020 × 248** (plot insets: left 62px (Shopee) / 92px (FPT), right 46, top 26, bottom 30). Same geometry rules as `ReplayChart` (fixed y-domain incl. target/prediction/baseline, pad 22%).
    - Grid: 5 horizontal lines, solid 1px `#D9D4C8`. Y labels Mono 400 15px `#5E5A52`, right-aligned 14px left of plot. X labels (4 dates dd/mm) Mono 15px.
    - Future band: rect 38px wide centred on x(L), from y=18, fill `#F6E1DA`, label above (`Ngày mai`/`Phiên tới`) 600 14px `#D2462A`.
    - Full window (unread): 2px `#C9C3B6`. Read portion: 3px `#161512`, round joins.
    - Cursor: vertical line 1px `#161512` dash `2 4`; dot r=7 `#161512`, stroke 3 `#F6F4EF`.
    - Prediction (phase ≥1): baseline segment 2px `#8D877B` dash `5 4`; RNN segment 3px `#D2462A` round cap; dot r=8 `#D2462A` stroke 3 `#F6F4EF`.
    - Actual (phase ≥2): segment 3px `#161512` + diamond (16px) `#161512` stroke 2 `#F6F4EF`.
  - Legend row 15px `#5E5A52`, gap 20px: `Lịch sử` (18×3 ink bar), `RNN` (9px accent dot), `Thực tế` (8px ink diamond), `Giữ nguyên` (18px dashed `#8D877B`); right: date range Mono 14px.
- Detail panel (aside): `border-left: 1px solid #D9D4C8; padding: 16px 0 12px 28px`, content vertically centred. Content per phase (same logic and copy as `PhasePanel`):
  - **Phase 0 – Đọc chuỗi**: title (`RNN bắt đầu từ đâu?` / `Đọc ngày N / 30`) Newsreader 500 32px/1.15. Row `Đầu vào · dd/mm` | `5 giá trị` 15px with `border-bottom: 1px solid #161512; padding-bottom: 8px; margin-top: 14px`. Values grid (2 cols Shopee, 1 col FPT, gap 10px 20px): label 14px `#5E5A52`, value Newsreader 500 30px/1.1 tabular. Footnote 14px/1.5 `#5E5A52` (`extra` + `preprocessing`).
  - **Phase 1 – Dự đoán**: title `Đọc đủ chuỗi → dự đoán`; `Mốc dự báo: dd/mm/yyyy` 15px muted; `Dự đoán RNN` 16px muted; value Newsreader 500 **80px**/1 `#D2462A` letter-spacing −0.03em; unit 18px; `Đã đọc đủ 30 ngày quá khứ.` 16px muted; link `Xem cách đổi đơn vị` 15px accent underlined.
  - **Phase 2 – Thực tế**: title `Đối chiếu một dự đoán`; `Cùng đơn vị: …` 15px muted; three rows (RNN accent / Thực tế ink / Giữ nguyên `#8D877B`), each `padding: 8px 0`, label 16px, value Newsreader 500 38px tabular; first row `border-top: 1px solid #161512`, others `#D9D4C8`, last also bottom border. Error list 15px (Sai số RNN / Sai số giữ giá trị cuối), takeaway 15px/1.45 weight 500.
  - **Phase 3 – Toàn tập**: title `Trung bình dự đoán lệch bao nhiêu?` 30px; explanation 14px muted; two bar rows: label 15px + value Newsreader 500 24px; bar track 10px `#E9E5DC`, fill baseline `#8D877B` / RNN `#D2462A`, widths proportional to max(MAE). `compareText` 17px 500 with `border-top: 1px solid #161512; padding-top: 10px`; `Biểu đồ bên cạnh chỉ là một ví dụ.` 14px muted.

**c. Mechanism strip ("BÊN TRONG RNN")** — `position: relative; padding: 10px 0 22px; border-bottom: 1px solid #161512`.
- Header row (margin-bottom 10px): left `BÊN TRONG RNN — {phaseMessage}` Mono 500 13px letter-spacing .06em `#5E5A52`; right links `Xem phép tính`, `Code mô hình`, `Code huấn luyện` 14px `#D2462A` underlined (offset 3px), gap 18px. (`phaseMessage` = the messages in `RecurrentMechanism`.)
- Grid `1.25fr 28px 0.8fr 28px 1.15fr 28px 1fr`, gap 14px, align center:
  1. **Input block** (`padding: 6px 8px`): `① Dữ liệu mới · 5 số · xₜ` 15px muted; group name Newsreader 500 22px (`Hành vi trong ngày` / `Lợi suất log`); nested **previous-state block** (`padding: 4px 6px; margin: 0 -6px`): `Trạng thái trước · {Ban đầu: tất cả bằng 0 | Từ ngày N · hₜ₋₁}` 14px muted + **vector grid**.
  2. Arrow (`arrow-right` 28×24, stroke 1.6).
  3. **RNN block**: `border: 1px solid #161512; padding: 10px 14px`, centred; `② RNN` Newsreader 500 34px/1.1 (② in Mono 15px); `Dữ liệu mới + trạng thái trước` 14px; note 13px muted (`Cùng trọng số đã học` or `Đang cập nhật…` during update).
  4. Arrow.
  5. **New-state block** (`padding: 6px 8px`): `③ Trạng thái mới · hₜ` (or `Trạng thái cuối · hₜ` at step 30) 15px muted; vector grid; legend row 13px muted: `32 số tóm tắt chuỗi đã đọc.` + swatches 10×10 `Âm` / `0` / `Dương`.
  6. Arrow (opacity .3 until predicted).
  7. **Output block** (`padding: 6px 8px`): `④ Tạo 1 dự báo`; `Trạng thái cuối → Linear · {Đổi về số đơn hàng | Đổi thành giá VND}` 14px muted; value Newsreader 500 28px/1.2 — `#A39D90` text `Chờ đủ 30 ngày` before prediction, `#D2462A` formatted prediction after.
- **Vector grid** (both previous and new state — must be identical so the audience sees one become the other): CSS grid 16 columns × 2 rows, rows 11px, gap 2px, width 232px, square cells. Cell colour = `stateColor` with this palette: positive `rgba(210,70,42,α)`, negative `rgba(111,106,96,α)`, exactly 0 `#E9E5DC`, `α = 0.2 + |v|·0.8`.

**d. Presenter footer** — `padding: 14px 0 18px`, grid gap 12px.
- Caption row: 10px dot (`#D2462A` while playing, `#A39D90` paused) + caption Newsreader 400 25px/1.25 (`getCaption`).
- Controls row (flex, gap 18px, align center):
  - Primary button: min-width 230px, height 54px, `padding: 0 22px`, bg `#D2462A`, hover `#161512`, text `#fff`, filled `play` icon 20px, label 500 18px. Label logic: `Chạy tập này` (frame 0) / `Tạm dừng` (playing) / `Tiếp tục` / `Xem thực tế` (phase 1) / `Xem toàn tập` (phase 2) / `Sang FPT` (Shopee phase 3) / `Tổng kết` (FPT phase 3).
  - Restart: 54×54, `border: 1px solid #161512`, transparent, `rotate-ccw` 20px. Title `Chạy lại tập này`.
  - Scrubber (flex 1): label row 14px muted (dataset name | `N/30 ngày` in Mono 500 14px ink), `<input type=range min=0 max=31>` with `accent-color: #D2462A`.
  - Speed segmented: `border: 1px solid #161512`; buttons `0,5×` `1×` `2×`, `padding: 10px 14px`, Mono 500 15px; active bg `#161512` text `#F6F4EF`.
  - Key hint: `<kbd>Space</kbd> phát / dừng` — kbd Mono 500 13px, `border: 1px solid #161512; padding: 3px 7px`; text 14px muted.

### 2. Tổng kết (Summary) — chapter 03
Replaces `DemoSummary`. Grid rows `76px | 1fr | auto`; `main padding: 44px 48px 0`, flex column gap 30px.
- Eyebrow `03 — TỔNG KẾT · TOÀN TẬP KIỂM TRA`; title `Cùng là RNN, hiệu quả khác nhau.` Newsreader 500 68px/1.05 −0.03em; lead 20px muted max 1000px (`Mỗi dự đoán lệch thực tế bao nhiêu? …`).
- Two-column grid with `border-top` and `border-bottom` 1px `#161512`. Each article `padding: 26px 40px 26px 0` (second column `padding-left: 40px`), `border-right: 1px solid #D9D4C8`, flex column gap 16px:
  - Name Newsreader 500 40px (nowrap) | `216 dự đoán · đơn` Mono 500 15px muted.
  - Baseline row: label 18px + value Newsreader 500 32px tabular; bar 14px track `#E9E5DC` fill `#8D877B`.
  - RNN row: same, value + fill `#D2462A`.
  - `compareText` 20px 500. Link `Xem lại demo →` 16px accent underlined → jumps to that dataset's demo (reset to frame 0).
- Conclusion: Newsreader 500 30px/1.3 max 1100px (`Một dự đoán đúng chưa chứng minh mô hình tốt. …`) + limit note 16px muted; right: `Code đánh giá`, `Code huấn luyện` links 15px accent.
- Footer: back `02 FPT` (returns to FPT demo at phase 3), narration `Một mô hình cần được đánh giá trên nhiều mốc thời gian.`, next `04 Dự báo hôm nay`.

### 3. Dự báo hôm nay (Daily forecast) — chapter 04
Replaces `DailyForecast` + `InvestmentOutlook` presentation. Grid rows `76px | 1fr | auto`; `main padding: 26px 48px 0`, grid rows `auto auto 1fr`, gap 18px.
- Heading: eyebrow `04 — GIÁ ĐÓNG CỬA · MỖI PHIÊN`; title `FPT sẽ đóng cửa ở mức nào?` 52px. Right column: outlined button `Cập nhật & dự báo` (height 48px, `padding: 0 18px`, `border: 1px solid #161512`, `refresh-cw` 18px, 500 16px) above dateline `Dữ liệu đến 7/10/2026 · Lấy dữ liệu lúc …` Mono 400 14px muted with `clock-3` 15px.
- Overview section: grid `1fr 420px`, `border-top: 1px solid #161512; border-bottom: 1px solid #D9D4C8`.
  - Chart column `padding: 14px 28px 12px 0`; caption `30 mức thay đổi giá gần nhất → RNN → dự báo phiên kế tiếp.` | `VND / cổ phiếu`. Chart **1040 × 250** (insets left 76, right 50, top 20, bottom 30): 4 grid lines `#D9D4C8`, 60-session history 2.5px `#161512`, last-close dot r5 ink, dashed prediction segment 3px `#D2462A` dash `6 4`, prediction dot r8 accent stroke 3 paper, label `Phiên kế tiếp` 600 14px accent. Y labels Mono 14px (vi-VN thousands `.`), x labels dd/mm.
  - Readout aside `border-left: 1px solid #D9D4C8; padding: 18px 0 14px 28px`: `PHIÊN GIAO DỊCH KẾ TIẾP` Mono 500 14px; value Newsreader 500 **84px**/1 accent (+ ` VND` 24px ink); `Tăng 0,27% so với phiên cuối` 500 18px; two rows (15px, top border `#D9D4C8`): `Giá đóng cửa 7/10/2026 — 59.700 VND`, `Thực tế phiên kế tiếp — Chưa có trong dữ liệu`; disclaimer pinned bottom 14px/1.5 muted.
- Lower section grid `1.25fr 1fr`, gap 48px:
  - **Góc nhìn 1–6 tháng** (Newsreader 500 28px) | `Giá mốc 59.700 VND` Mono 14px. Three columns with `border-top: 1px solid #161512`, each `padding: 12px 18px 0 0; margin-right: 18px; border-right: 1px solid #D9D4C8`: `21 PHIÊN · 1 tháng` Mono 500 13px muted; price Newsreader 500 36px/1.2; `Tăng +3,63%` 15px; tag `THỬ NGHIỆM` Mono 500 12px accent. Note 14px muted. (Tabs from `InvestmentOutlook` become three side-by-side columns; the "Hỏi thêm…" link and collapsible details move to Phụ lục / out of scope.)
  - **Mô hình dự báo tốt đến đâu?** 28px; `287 dự đoán từ 11/8/2025 đến 6/10/2026. …` 14px muted; two bar rows (grid `200px 1fr auto`, gap 12px, 15px; bar 10px track `#E9E5DC`, RNN `#D2462A`, persistence `#8D877B`; value Newsreader 500 22px); direction-accuracy row with top rule; verdict 16px 500.
- Footer: back `03 Tổng kết`, narration `Cùng mô hình, dữ liệu giá mới nhất.`, next `05 Hỏi đáp`.

### 4. Hỏi đáp (Chat) — chapter 05
Replaces `StockChat` chrome. `main` grid `500px | 1fr`.
- Sidebar `padding: 40px 40px 32px 48px; border-right: 1px solid #161512`, flex column gap 20px: eyebrow `05 — CHAT ĐẦU TƯ · FPT`; h2 `Cổ phiếu FPT.<br>Hiểu trước khi đầu tư.` Newsreader 500 44px/1.1; lead 18px/1.5 muted; reference block (`border-top: 1px solid #161512; border-bottom: 1px solid #D9D4C8; padding: 14px 0`): `Dữ liệu đang tham khảo · FPT` 14px muted, price Newsreader 500 46px/1.15 + ` VND` 20px, `Giá đóng cửa …` 15px, link `Xem giá & dự báo FPT →` 15px accent (→ chapter 04); scope note 14px/1.55 muted; bottom row: outlined `Cuộc trò chuyện mới` (height 46px, `plus` 17px) and status (`8px` ink dot + `Đã kết nối` muted) — wire to the real `connectionLabels`.
- Conversation `padding: 40px 64px 28px`, rows `1fr auto`, max-width 900px:
  - Empty state (vertically centred, gap 22px): `Bạn đang cân nhắc điều gì?` Newsreader 500 44px; lead 18px muted; numbered prompt list `<ol>` with `border-top: 1px solid #161512`; each row grid `48px 1fr 24px`, `padding: 16px 0; border-bottom: 1px solid #D9D4C8`, 20px; number Mono 500 15px muted; `arrow-up-right` 20px; hover colour `#D2462A`. Prompts = the existing `prompts` array.
  - Composer: `border: 1px solid #161512; background: #fff; padding: 14px 14px 14px 20px`; textarea 19px/1.45, placeholder colour `#8D877B`; send button 48×48 bg `#D2462A` with `arrow-up` 20px. Disclaimer 13px muted below.
  - Conversation turns, citations, sources, pending/error states are not redesigned — keep `StockChat` behaviour and restyle with the tokens below (ink text, Newsreader for assistant headings optional, hairline separators, accent links).

### 5. Phụ lục (Appendix: Dữ liệu & công thức)
Replaces the `#explore` `DatasetExplorer` + `Results` as a single-screen summary; the long scrolling explorer can remain behind it for deep dives. `main padding: 30px 48px 32px`, rows `auto 1fr`, gap 22px.
- Heading: eyebrow `PHỤ LỤC · DỮ LIỆU VÀ CÔNG THỨC`; title `Hai tập dữ liệu` 52px; lead `Xem dữ liệu và dự báo về giao dịch và giá cổ phiếu.` 18px muted. Right: dataset toggle `border: 1px solid #161512`, two buttons `padding: 12px 22px` (name 500 17px + type 13px @ .8 opacity); selected bg `#161512` text `#F6F4EF`.
- Body grid `1fr 500px`, gap 44px, `border-top: 1px solid #161512; padding-top: 20px`.
  - Left: question (Newsreader 500 30px), description 16px/1.55 muted, source link 14px accent; facts (Số mốc dữ liệu / Tần suất / Lịch sử dùng) label 14px muted + Newsreader 500 34px; caption row; overview chart **940 × 300** (1.5px ink line, 4 grid lines, year x-labels); note `Biểu đồ chỉ hiển thị một phần số mốc dữ liệu.`
  - Right (`border-left: 1px solid #D9D4C8; padding-left: 40px`, gap 26px): **Chia dữ liệu theo thời gian** — split bar 30px tall, gap 3px, segments 70% `#161512` / 15% `#8D877B` / 15% `#D2462A`, Mono 500 13px labels; three columns (Huấn luyện / Chọn mô hình / Kiểm tra: n mẫu + date range). **Kết quả dự báo · MAE** — one row per model (grid `150px 1fr 90px`, gap 12px, `padding: 7px 0`, top rule `#D9D4C8`, 15px), bar 8px: RNN/GRU `#D2462A`, baselines `#8D877B`; labels from `modelLabels`.

## Interactions & Behavior

### Navigation
- Chapter bar items are clickable on every screen. `01`/`02` open the demo with that dataset reset to frame 0 (paused). `03`–`05` open their screens. `Phụ lục` opens the appendix.
- Footer back/next buttons as listed per screen. `02 FPT` back from Tổng kết restores the FPT demo at phase 3 (frame L+3).
- On the demo, after FPT phase 3 the primary button goes to Tổng kết; after Shopee phase 3 it switches to FPT (frame 0).
- **Keyboard**: `Space` — on demo = `toggle()` (existing semantics); elsewhere = next chapter. `←/→` = previous/next chapter on non-demo screens. Ignore when focus is in input/textarea/select/button (as today).
- **URL hash**: `#demo`, `#fpt`, `#tong-ket`, `#du-bao`, `#hoi-dap`, `#phu-luc`; written with `history.replaceState`, read on load. Keep the legacy hash redirects in `Shell.tsx` (map old `#fpt-daily` → `#du-bao`, `#chat` → `#hoi-dap`, `#explore-*` → `#phu-luc`).
- Chat state must persist when navigating away and back (as today with `chatVisited`).

### Demo playback (unchanged timing from `replayTimeline.ts`)
- Frame 0: 1200ms; frames 1–2: **4400ms** each; frames 3…L: 250ms; divided by speed (0.5/1/2). Auto-stops at Predict (phase 1); phases 2 and 3 are manual.
- Scrubbing sets `snapshot = true` (show the stored state for that step without animation), pauses, hides prediction/actual when moving back.

### Step animation ("BÊN TRONG RNN") — must be reproduced
Driven by the existing `progress` (0→1 within the current frame) and `getHandoverPhase(read, L, progress, snapshot)`; only animates on steps 1 and 2.
| Progress | Phase | Visual |
|---|---|---|
| < 0.20 | `input` | Input block highlighted; arrow ①→② accent |
| 0.20–0.42 | `update` | RNN block highlighted; note text `Đang cập nhật…` |
| 0.42–0.58 | `state` | New-state block highlighted; arrow ②→③ accent |
| ≥ 0.58 (read < L) | `transfer` | Previous-state block highlighted; packet travels |
| step ≥ 3 or snapshot | `state` | static |
| predicted | `output` | Output block highlighted; arrow ③→④ accent |
- Highlight style: background `#F6E1DA` + `box-shadow: 0 0 0 2px #D2462A` (use box-shadow so layout never shifts). Inactive arrows `#161512`.
- During `input`/`update` the new-state grid is `opacity: .12; filter: saturate(0)` (not computed yet); during `transfer` `opacity: .28`.
- **Packet**: a copy of the 32-cell new-state grid (same 16×2 layout, white bg, `outline: 1.5px solid #D2462A; outline-offset: 4px`, shadow `0 0 0 4px #fff, 0 3px 8px 4px rgba(0,0,0,.12)`) moves along a route: down from the centre of the new-state grid to a rail at `mechanismHeight − max(gridH)/2 − 3`, left along the rail, up into the previous-state grid. Position = `getTransferPosition((progress − 0.58)/0.42, geometry)`; size interpolates between the two grids (identical here). Measure DOM boxes with `getBoundingClientRect` divided by the stage scale, re-measure on resize (ResizeObserver, as `StateHandover.tsx`).
- **Route line**: 1.5px, round caps/joins, `#8D877B` @ 35% opacity on steps 1–2; `#D2462A` @ 80% during transfer; small chevron arrowhead (10px wide) pointing up under the destination grid. Hidden from step 3 onward and after prediction.
- Respect `prefers-reduced-motion`: hide packet and route, show grids at full opacity (as existing CSS).

### Other states
- Loading / error states for data fetches: reuse existing copy (`Đang tải hai mô hình…`, `Không tải được dữ liệu demo.` + `Thử lại`), centred on paper, Newsreader 25px.
- Dialogs (`Giải thích nhanh`, `Xem phép tính`, `Dữ liệu & phép tính`) were not redesigned; keep `DemoDialog` behaviour (pause on open) and restyle: paper bg, `1px solid #161512` border, square corners, Newsreader titles.

## State management
Existing `useDemoPlayback` covers `index/frame/playing/speed/progress/snapshot/summary`. Add at the shell level:
- `screen: 'demo' | 'summary' | 'daily' | 'chat' | 'appendix'` (replaces `explore/daily/chat` booleans in `Shell.tsx`; summary is promoted from a demo sub-state to a chapter).
- `appendixDataset: 'shopee' | 'fpt'`.
- Stage `scale` from window resize.
Chapter "done" marks derive from current chapter index (all chapters before the current one).

## Design tokens
**Colours**
| Token | Hex | Use |
|---|---|---|
| paper | `#F6F4EF` | page/stage background, text on ink |
| ink | `#161512` | text, primary rules, active fills |
| muted | `#5E5A52` | secondary text |
| faint | `#A39D90` | upcoming/disabled text |
| rule | `#D9D4C8` | hairlines, grid lines |
| accent | `#D2462A` | RNN, current, primary buttons, links |
| accent-soft | `#F6E1DA` | future band, highlight fill |
| baseline | `#8D877B` | "giữ nguyên" series, validation split |
| track | `#E9E5DC` | bar tracks, zero state cell |
| unread | `#C9C3B6` | not-yet-read history line |
| white | `#FFFFFF` | composer field, packet |
| state + | `rgba(210,70,42,α)` | positive hₜ cells |
| state − | `rgba(111,106,96,α)` | negative hₜ cells |

**Typography** (Google Fonts; all have Vietnamese subsets)
- Display / numerals: **Newsreader** (opsz 6–72) 400/500/600. Sizes: 84, 80, 68, 52, 50, 46, 44, 40, 38, 36, 34, 32, 30, 28, 25, 24, 23, 22.
- UI / body: **IBM Plex Sans** 400/500/600. Sizes: 20, 19, 18, 17, 16, 15, 14, 13.
- Labels / axes / codes: **IBM Plex Mono** 400/500. Sizes: 15, 14, 13, 12.
- Numbers: `font-variant-numeric: tabular-nums`; vi-VN formatting (`.` thousands, `,` decimals).
- Note: this replaces Be Vietnam Pro (local TTFs) — if offline use matters, self-host the three families under `public/fonts/` with their OFL licences.

**Spacing**: page gutters 48px (nav 40px); recurring gaps 6, 8, 10, 12, 14, 18, 22, 28, 30, 40, 44, 48px.
**Radii**: 0 everywhere (square). Circles only for chart dots and status dots.
**Borders**: 1px `#161512` for section/primary rules and outlined controls; 1px `#D9D4C8` for secondary rules.
**Shadows**: none, except the transfer packet.

## Assets
- Icons: **lucide** (already a dependency via `lucide-react`): `book-open`, `maximize-2`, `arrow-right`, `arrow-left`, `arrow-up`, `arrow-up-right`, `play`, `pause`, `rotate-ccw`, `refresh-cw`, `clock-3`, `plus`. Stroke 1.6–2.
- No images. Wordmark is pure type.

## Copy notes
All Vietnamese copy is taken verbatim from the codebase except these new strings introduced by the redesign: chapter labels `Tổng kết`, `Dự báo hôm nay`, `Hỏi đáp`, `Phụ lục`; eyebrows (`01 — SHOPEE THAILAND · …`, `03 — TỔNG KẾT · TOÀN TẬP KIỂM TRA`, `04 — GIÁ ĐÓNG CỬA · MỖI PHIÊN`, `05 — CHAT ĐẦU TƯ · FPT`, `PHỤ LỤC · DỮ LIỆU VÀ CÔNG THỨC`); `BÊN TRONG RNN —`; `Sang FPT`; `THỬ NGHIỆM`; footer narration `Cùng mô hình, dữ liệu giá mới nhất.`; outlook note sentence `Cả ba mốc chưa tốt hơn cách giữ nguyên giá trên tập kiểm tra.` (derived from `support.beats_persistence = false` for all horizons — render conditionally). Have the content owner review these.

## Responsive
Designed as a fixed 16:9 stage for projection; scale uniformly. Below ~900px viewport width (phones), fall back to the existing responsive layouts or stack columns — not designed here.

## Files
- `Sequence.dc.html` — the interactive prototype (open in a browser next to `support.js` and `sequence-data.js`). All five screens, navigation, keyboard, hash routing and the step animation.
- `sequence-data.js` — data snapshot exported from `public/data/*.json` plus view helpers that mirror the domain functions listed above (`stage`, `player`, `handover`, `transfer`, `cells`, `dailyView`, `overviewView`, `explorer`). Reference only.
- `support.js` — runtime needed to open the prototype; not part of the implementation.
- `reference/Redesign A Editorial.dc.html` — all five screens laid out side by side (canvas view).
- `reference/Current Demo Stage.dc.html` — recreation of today's demo screen, for before/after comparison.
