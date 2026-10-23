# 衝向寶島 FORMOSA RUN

《衝向寶島》是從高雄港出發，沿分岔路線遊覽全台的網頁街機賽車遊戲。這是獨立新版的開發專案，由原專案目前的開發工作樹複製而來；保留 Canvas 遊戲邏輯、WebGL／HD2D 實驗畫面及 Godot 開發基底。獨立遠端倉庫已建立；目前網頁尚未發布，美術仍在審稿與製作中。

原《衝向墾丁》的 GitHub 倉庫與遊玩網址獨立保留，不由本專案覆蓋。新版使用 [Gajuioredvmn/formosa-run](https://github.com/Gajuioredvmn/formosa-run)，並維持直接用瀏覽器遊玩；新版正式遊玩網址待 GitHub Pages 發布後確認。

- 10 台可選車，各有不同的極速、加速、抓地力、重量及檔位。
- 5 關、每次二選一，路線樹為 `1 → 2 → 4 → 8 → 16`，共 31 段不同路線、30 條連接與 16 個終點。
- 山路包含阿里山、屏東沿山公路、清境／合歡山、太魯閣與蘇花路段；沿途也有城市、港區、農田、湖岸與海灘。
- 在時間內通過檢查點可獲得加時；支援自排、H 檔手排、循序手排、車流閃避、甩尾及碰撞恢復。

- 原《衝向墾丁》遊玩網址（保留）：https://gajuioredvmn.github.io/kenting-run/
- 原專案倉庫（保留）：https://github.com/Gajuioredvmn/kenting-run
- 手機請橫向遊玩：左右傾斜手機轉向，右手油門／煞車，手排用左手在畫面左側畫 H 檔。
- 電腦：方向鍵或 WASD 開車，Z 油門、X 煞車，Q / E 或 1–6 換檔，Esc 暫停。

本機以 `node tools/serve.cjs` 啟動，再開啟 `http://127.0.0.1:4173/`。伺服器會提供正確的 ES module MIME，不需要建置步驟。加上 `?renderer=classic` 可使用原像素畫面；WebGL 無法使用時亦保留 Canvas 備援。

Godot 4.7.2 可直接匯入根目錄 `project.godot`。使用 Compatibility renderer，以網頁及手機為優先；`data/game.json` 保存實際路線幾何、10 車參數、乘員及分支。修改路線後執行 `node tools/export-data.cjs`，由瀏覽器實際路線重新匯出，避免另維護一張不同地圖。這個匯出工具需要 Playwright 與 Chromium／Edge。

目前高解析手繪車輛僅完成 ROSSO 追車素材及一種同向車流，其他車型仍待重畫。車輛畫風及 B 版暖陽／冷影方向已通過審稿；滿舵審稿 03 的幅度與比例也已獲准，並接入網頁版：單張後視原畫持續柔彎／側傾、固定追車距離及後軸尺度，只有真實接觸受力可激發短暫抬輪，低速與平路滿舵不會憑空兩輪行駛。此處是依遊戲受力資料驅動的視覺模型，保留原本操控及碰撞尺寸；Godot 尚未同步這組新動作。

騎樓的實體深度、街邊行人／停車／花草及更強的手繪漫畫風格，目前仍在獨立預覽審稿，尚未接入本專案。其他新場景美術亦須先提供預覽、取得使用者同意後再整合。既有像素風格、遊戲玩法與原線上版本保留；目前美術尚未達商業成品完成度。

碰撞使用公斤質量、相對法向速度、等反向衝量及有限摩擦；中央碰撞不再隨機彈起或旋轉。交通生成與移動會檢查連續可通行空間，避免同一側永久空白的捷徑。手機本地 60 FPS 是目標，桌面瀏覽器或模擬手機視窗的量測不等於手機實機驗證。`exports/` 為本機匯出位置，不納入 Git；舊 debug APK 需在來源更新後重新匯出才能代表最新版。

回歸檢查使用 Node.js 內建模組，無需安裝套件：

```sh
node tests/gameplay.test.cjs
node tests/scenery.test.cjs
node tests/traffic.test.cjs
node tests/physics.test.cjs
node tests/geography.test.cjs
```

測試涵蓋重新開局、輸入狀態、檢查點與終點計時、分岔、碰撞、連續交通通路、路側淨空及地區地標。畫面、觸控與裝置感應另以實際瀏覽器／實機驗證。`assets/*meta.json` 與 `*.prompt.txt` 保存內建 imagegen 素材的提示詞及來源；第三方程式庫和字型附原授權。

## 獨立新版的網頁發布準備

`.github/workflows/pages.yml` 僅接受手動 `workflow_dispatch`，沒有 push 或 pull request 自動部署。美術與版本經使用者同意後，可在新版倉庫的 Settings → Pages 將 Source 選為 GitHub Actions，再於 Actions 手動執行發布。流程只接受 `main` 分支；目前尚未執行網頁發布。

本機可執行 `node tools/package-pages.cjs`，將網頁需要的 `index.html`、路線腳本、繪圖模組、Three.js、圖片及字型放進 `_site/`。打包程式保留相對路徑，支援 `/formosa-run/` 專案子目錄；不包含 Godot 原始碼、原生模型、測試、提示詞、生成中繼資料或建置快取。Godot 原始碼與 10 車／31 路線資料仍保留在開發倉庫。輸出資料夾若已存在，程式會停止，避免覆寫其他檔案。

工作流程版本與權限依據 [GitHub Pages 自訂工作流程官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)；手動執行方式見 [GitHub Actions 官方文件](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)。
