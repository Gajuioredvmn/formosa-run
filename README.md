# 衝向寶島 FORMOSA RUN

《衝向寶島》是從高雄港出發，沿分岔路線遊覽全台的網頁街機賽車遊戲。新版以原《衝向墾丁》的 Canvas 偽 3D 引擎製作細緻像素場景，保留原本轉向、加速、煞車、換檔、追車相機、道路推進及速度特效。WebGL 實驗畫面及 Godot 開發基底亦保存在本專案，但不作為預設網頁畫面。這是持續開發中的可玩測試版。

原《衝向墾丁》的 GitHub 倉庫與遊玩網址獨立保留，不由本專案覆蓋。新版使用 [Gajuioredvmn/formosa-run](https://github.com/Gajuioredvmn/formosa-run)，網頁發布位置為 [衝向寶島](https://gajuioredvmn.github.io/formosa-run/)。

- 10 台可選車，各有不同的極速、加速、抓地力、重量及檔位。
- 5 關、每次二選一，路線樹為 `1 → 2 → 4 → 8 → 16`，共 31 段不同路線、30 條連接與 16 個終點。
- 山路包含阿里山、屏東沿山公路、清境／合歡山、太魯閣與蘇花路段；沿途也有城市、港區、農田、湖岸與海灘。
- 在時間內通過檢查點可獲得加時；支援自排、H 檔手排、循序手排、車流閃避、甩尾及碰撞恢復。

- 原《衝向墾丁》遊玩網址（保留）：https://gajuioredvmn.github.io/kenting-run/
- 原專案倉庫（保留）：https://github.com/Gajuioredvmn/kenting-run
- 手機請橫向遊玩：左右傾斜手機轉向，右手油門／煞車，手排用左手在畫面左側畫 H 檔。
- 電腦：方向鍵或 WASD 開車，Z 油門、X 煞車，Q / E 或 1–6 換檔，Esc 暫停。

本機以 `node tools/serve.cjs` 啟動，再開啟 `http://127.0.0.1:4173/`。伺服器會提供正確的 ES module MIME，不需要建置步驟。預設為 Canvas 像素版，`?renderer=classic` 亦可；只有明確加上 `?renderer=hd` 才會載入先前的 WebGL 實驗版。畫面與碰撞資料同步選擇，避免切換畫面後留下看不見的障礙。

Godot 4.7.2 可直接匯入根目錄 `project.godot`。使用 Compatibility renderer，以網頁及手機為優先；`data/game.json` 保存實際路線幾何、10 車參數、乘員及分支。修改路線後執行 `node tools/export-data.cjs`，由瀏覽器實際路線重新匯出，避免另維護一張不同地圖。這個匯出工具需要 Playwright 與 Chromium／Edge。

新像素素材目前優先更新 ROSSO 車身與兩位乘員、高雄港街屋、棕櫚、港區和遠景。其他九台保留原本獨立車型與參數，尚未完成同等規格的美術重畫。已核准的滿舵動作接入 ROSSO：單張後視圖持續柔彎／側傾、固定原車寬與接地基準，接觸受力才能激發短暫抬輪；平路先滑移，落地後自然回正。撞車旋轉保留原本各角度車圖。這是讀取遊戲受力的視覺模型，不改車輛操控或碰撞尺寸。

街屋使用沿道路投影的多層幾何：樓上外牆、內退店面、外柱、側牆、騎樓橫梁及突出雨棚分開繪製，隨移動產生視差與遮擋。上方裝飾不產生地面隱形牆。地區地標、31 段路線與 16 個終點均有檢查；全台每一段同等完成度的美術仍在製作，不能視為商業成品已全部完成。

集集綠色隧道段保留連續瀝青公路，左側鐵道以獨立路基、護欄與火車呈現，移除突然把行車道換成鐵軌的配置。公路與鐵路並行的地理對照參考 [日月潭管理處的綠色隧道介紹](https://www.sunmoonlake.gov.tw/attractions/Attractions?A=20&Id=36&P=1)；遊戲路線是街機化改編。

單人與多人每一輪均保留轉鑰匙、儀表亮燈、啟動引擎和起跑倒數。多人透過公用 PeerJS 配對與 WebRTC 資料通道連線，最多八人，由房主分配錯開雙列格位、固定每台車位置並同步起跑時刻；中途加入／重連不會重排其他人。預備起跑時交通車不能推移格位。多人玩家彼此目前為不碰撞的 ghost，交通車與路側障礙則有實體碰撞；尚無伺服器權威的玩家間碰撞系統。

碰撞使用公斤質量、相對法向速度、等反向衝量及有限摩擦；中央碰撞不再隨機彈起或旋轉。交通生成與移動會檢查連續可通行空間，避免同一側永久空白的捷徑。手機本地 60 FPS 是目標，桌面瀏覽器或模擬手機視窗的量測不等於手機實機驗證。Godot 保存十車、完整路線與原生程式；本次 Canvas 像素美術、滿舵呈現及多人更新尚未同步為原生版本。`exports/` 為本機匯出位置，不納入 Git；舊 debug APK 不代表最新版。

回歸檢查使用 Node.js 內建模組，無需安裝套件：

```sh
node tests/gameplay.test.cjs
node tests/scenery.test.cjs
node tests/traffic.test.cjs
node tests/physics.test.cjs
node tests/geography.test.cjs
node tests/multiplayer.test.cjs
```

瀏覽器與真實多人測試（需 Playwright 及 Chromium／Edge；多人測試需可連上公用 PeerJS）：

```sh
node tools/verify-browser.cjs <報告目錄>
node tools/verify-multiplayer.cjs <報告目錄>
```

測試涵蓋重新開局、輸入狀態、檢查點與終點計時、分岔、碰撞、連續交通通路、路側淨空、地區地標、多人格位、時間校準及過期封包。`node tools/verify-browser.cjs <報告目錄>` 可用 Playwright／Edge 實測網頁子目錄、實際選車流程、點火動畫、10 車及 31 路段。多人另已用獨立 Edge contexts、公用 PeerJS 與真實 WebRTC 驗證三人位置轉發／重連／再次起跑，以及八人連線與格位；不等同八台手機實機比賽或效能認證。`assets/**/*meta.json` 與 `*.prompt.txt` 保存內建 imagegen 素材的提示詞及來源；第三方程式庫和字型附原授權。

## 獨立新版的網頁發布準備

`.github/workflows/pages.yml` 僅接受手動 `workflow_dispatch`，沒有 push 或 pull request 自動部署。新版倉庫 Settings → Pages 的 Source 為 GitHub Actions，於 Actions 手動執行發布。流程只接受 `main` 分支，原《衝向墾丁》的部署獨立保留。

本機可執行 `node tools/package-pages.cjs`，將網頁需要的 `index.html`、路線腳本、繪圖模組、Three.js、圖片及字型放進 `_site/`。打包程式保留相對路徑，支援 `/formosa-run/` 專案子目錄；不包含 Godot 原始碼、原生模型、測試、提示詞、生成中繼資料或建置快取。Godot 原始碼與 10 車／31 路線資料仍保留在開發倉庫。輸出資料夾若已存在，程式會停止，避免覆寫其他檔案。

工作流程版本與權限依據 [GitHub Pages 自訂工作流程官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)；手動執行方式見 [GitHub Actions 官方文件](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)。
