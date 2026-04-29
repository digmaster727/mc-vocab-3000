# 國中必備 3000 單字 · 像素冒險 ⚔️

Minecraft 風像素打怪英文單字學習遊戲，純前端 PWA，可離線遊玩。

> **150 關 × 20 字 = 3000 字** · 涵蓋國中必備英文詞彙 · 雙玩家獨立存檔

## 🎮 功能特色

| 模組 | 說明 |
|---|---|
| 🗺️ **150 關卡主題** | 動植物、食衣住行、抽象詞、進階動詞、片語、化學元素… |
| 👹 **37 種 Minecraft 怪物** | 殭屍、苦力怕、海豚、狐狸、鐵魔像、地獄幽靈、掠奪者… |
| ⚔️ **主角揮劍動畫** | Steve 拿鑽石劍衝刺攻擊；答錯被怪物反擊 |
| 🎯 **動態難度** | 連續答對 → 出更長的單字；答錯歸零退回基礎題 |
| ✨ **強烈答對特效** | 紙屑爆破、Combo 文字、螢幕綠光、8-bit 琶音 |
| 🏆 **七階成就封號** | 新手 → 學徒 → 鐵騎兵 → 騎士 → 騎士團長 → 公爵 → 王者 |
| 🌟 **每日挑戰** | 全字庫種子隨機 10 題，當日首勝 +50💎 |
| 📓 **錯題複習** | 答錯字自動入池，答對則消除 |
| 🛒 **道具商店** | 補血藥水、雷霆強擊、砍半魔法、時光跳過 |
| 👥 **雙玩家存檔** | JOE / LEO 各自獨立進度（localStorage） |
| 📱 **PWA 離線** | 可加到主畫面，手機/平板像 App 一樣使用 |
| 🔊 **Web Speech 發音** | 自動朗讀英文單字 |

## 🛠 技術堆疊

- **HTML5 + CSS3 + Vanilla JavaScript**（無框架、無 build step）
- **Service Worker** + Web App Manifest = PWA
- **localStorage** 雙玩家 namespace 存檔（含 v1→v2→v3 自動遷移）
- **Web Audio API** 合成 8-bit 音效
- **Web Speech API** 朗讀單字
- **SVG** 程序生成怪物像素圖（6 種模板 × 37 隻怪物配色）
- **CSS keyframes** 動畫：揮劍、命中、死亡、Combo、紙屑

## 🚀 快速開始

### 本機執行（PWA 需 localhost）

PWA 不能在 `file://` 下直接運作，請挑一種方式開啟本機伺服器：

**方式 1：VS Code Live Server**
1. 安裝 Live Server 擴充
2. 開啟 `英文單字挑戰.html` → 右下角點 **Go Live**

**方式 2：Python**
```bash
python -m http.server 8000
```
打開 [http://localhost:8000/英文單字挑戰.html](http://localhost:8000/英文單字挑戰.html)

**方式 3：Node.js**
```bash
npx http-server -p 8000
```

### GitHub Pages 部署

1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main` / root
4. 儲存後等 1-2 分鐘 → 取得 `https://<帳號>.github.io/<repo>/英文單字挑戰.html`

## 📱 加到主畫面

### Android / Chrome / Edge
網址列右側 **安裝** 圖示 → 加到主畫面，圖示為像素草地方塊。

### iOS / Safari
分享 → 加入主畫面 → 命名「3000 單字」。

## 📂 專案結構

```
.
├── 英文單字挑戰.html          主 SPA 入口（5 個畫面）
├── manifest.json              PWA 資訊清單
├── sw.js                      Service Worker（離線快取）
├── icons/
│   ├── icon-192.svg
│   ├── icon-512.svg
│   └── icon-maskable.svg      Android 動態圖示
├── css/
│   └── minecraft-theme.css    像素 3D 按鈕、怪物動畫、Combo 特效
├── js/
│   ├── vocab-data.js          150 關 × 20 字 = 3000 字 (window.LEVELS)
│   └── app.js                 主控（戰鬥、存檔、UI、音效、動畫）
└── README.md
```

## 🎯 鍵盤快捷鍵

| 鍵 | 功能 |
|---|---|
| `1` `2` `3` `4` | 選答案 |
| `H` | 顯示 / 隱藏記憶提示 |
| `S` | 重新發音 |
| `Q` `W` `E` `R` | 使用道具：補血／強擊／砍半／跳過 |
| `Esc` | 退出本關 |

## 🏅 成就封號門檻（依累計 ⭐）

| ⭐ | 封號 | 圖示 |
|---|---|---|
| 0 | 新手 | 🌱 |
| 10 | 學徒 | 📖 |
| 30 | 鐵騎兵 | ⚔️ |
| 60 | 騎士 | 🛡️ |
| 100 | 騎士團長 | 🎖️ |
| 150 | 公爵 | 👑 |
| 200 | 王者 | 🌟 |

最高滿星 = 150 × 3 = **450⭐**

## 📜 授權

個人學習用途，請自由使用、修改、教學。Minecraft 視覺風格僅作二次創作致敬，所有 Minecraft 商標仍屬 Mojang Studios / Microsoft。

## 🙋 開發筆記

整個遊戲完全在 Claude Code 對話中迭代開發，從最初的 30 字示範到最終 3000 字 + PWA。
