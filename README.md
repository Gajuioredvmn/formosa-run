# 衝向寶島 FORMOSA RUN

《衝向寶島》是從高雄港出發，沿分岔路線遊覽全台的網頁街機賽車遊戲。新版以原《衝向墾丁》的 Canvas 偽 3D 引擎製作細緻像素場景，保留原本轉向、加速、煞車、換檔、追車相機、道路推進及速度特效。WebGL 實驗畫面及 Godot 開發基底亦保存在本專案，但不作為預設網頁畫面。這是持續開發中的可玩測試版。

原《衝向墾丁》的 GitHub 倉庫與遊玩網址獨立保留，不由本專案覆蓋。新版使用 [Gajuioredvmn/formosa-run](https://github.com/Gajuioredvmn/formosa-run)，網頁發布位置為 [衝向寶島](https://gajuioredvmn.github.io/formosa-run/)。

2026-10-29 更新：修正樹木突然鏡像、縮圖黑邊跳變與地面顏色誤判造成的消失。髮尾／布料加入隨車速平方增加的氣流、轉向慣性、急煞前甩及回擺，固定髮根和綁點。移除遮住路面的教學字幕，必要提示移至頂側；伸入車道的輕軌站圖像改為沿道路排列的平台、柱與頂棚。碰撞區分正撞、擦撞與有足夠側向衝量的抬輪落地，正常操控保持與原版一致。音樂校準提高 3 dB，持續引擎及風聲降低約 3.7 dB，音量滑桿、靜音、碰撞與換檔提示獨立保留。

Android 本地版的原始碼與建置說明在 [android-web](android-web/README.md)。它把相同 Canvas 遊戲、圖片、字型及 20 首音樂封裝於 APK，可離線玩單人模式；線上對戰仍需要網路。這是 Android WebView 封裝，Godot 原生版本的移植另行保留。APK 與簽章金鑰不提交到 Git，後續更新須沿用原簽章金鑰。

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

10 台車已各自換上新的像素後視車身與乘員圖，選車頁、行駛、遠端車和結局共用同一組角色。原班底為 19 位人物與豆豆一隻狗；人物像、服裝、髮型和車型分別繪製。每台車有獨立的滿舵柔彎／側傾、回正與慶祝呈現，固定原車寬與接地基準；短暫抬輪由接觸受力觸發，平路先滑移。頭髮、圍巾、頭紗及狗耳的局部擺動讀取車速、加速度、側向受力與風，使用有阻尼的動作狀態。這些視覺模型不回寫操控或放大碰撞尺寸。新素材以後視與人物像為主，未製作每台車完整的全角度轉身動畫。

Canvas 使用 270 列邏輯座標維持原追車構圖，在 540 列實際畫布繪製；道路取樣和車輛圖像也提高密度，保留細像素線條、較細緻的天空漸層與低對比路面顆粒。這是像素偽 3D 呈現，遠近物件透過投影、遮擋、霧色及分層景觀產生深度。桌面效能量測詳見 [本輪驗收報告](QA_RELEASE.md)。

街屋使用沿道路投影的多層幾何：樓上外牆、內退店面、外柱、側牆、騎樓橫梁及突出雨棚分開繪製，隨移動產生視差與遮擋。上方裝飾不產生地面隱形牆。地區地標、31 段路線與 16 個終點均有檢查；全台每一段同等完成度的美術仍在製作，不能視為商業成品已全部完成。

本輪補上高山、森林、海岸與峽谷的分層像素遠景，近處岩壁使用沿路投影的紋理；樹木與街屋依實際位置投下保留路面細節的冷色陰影。高山上段使用低矮灌木，城市大道主要使用直幹王棕，海岸保留少量自然彎幹椰子；樹根依乾地與水面分布配置。八卦山大佛基座回到地表，七股／北門鹽田改為有乾堤分隔的格池，不再鋪成整片白地。西螺大橋、龍騰斷橋、九份階巷與石梯坪分別使用自己的地方景觀。

遊戲路線採台灣景點與文化元素改編；跨縣路段會依所在章節更新地區名稱，但道路尺度、岔路和景點排列並非實地導航或一比一測繪。

集集綠色隧道段保留連續瀝青公路，鐵道有獨立路基。街機化路口增加預告牌、警鈴、閃燈、柵欄與橫向鋼軌：左側支路平緩升到平交道，右側主路從同一條鐵路橋下通過；列車到來前關閉平交道，車流規劃持續保留右側通道。公路與鐵路並行的地理對照參考 [日月潭管理處的綠色隧道介紹](https://www.sunmoonlake.gov.tw/attractions/Attractions?A=20&Id=36&P=1)；這是遊戲路線改編，並非特定真實路口的測繪。

31 段路線的路緣在景點配置完成後統一建立可見護欄或矮牆，碰撞使用相同邊界資料，避免車子開進水面、農田或從大片空地繞過車流。分岔道路尚未分離的內側保持開放。人與動物只從預建的 1.45 公尺窄通口進出，開口具有實際缺口、兩端立柱及短引道；最窄車身為 1.68 公尺，仍受路側邊界阻擋。群體各有錯開的通行位置，行人橫越不會從水面、懸崖或擋土牆後出現。每條路段也安排交錯超車機會；重型聯結車、油罐車等依路寬與地區出現，群體穿越與掉落貨物先提供提示，再以同一套通道檢查避免封死整條路。

16 個終點各有獨立的地方風景圖及 10 組三段角色故事，共 160 組結局。停車畫面、兩位旅伴的人物像與對話依選用車型對應；台北、南投、花蓮等目的地使用各自的地標與敘事。

單人與多人每一輪均保留轉鑰匙、儀表亮燈、啟動引擎和起跑倒數。多人透過公用 PeerJS 配對與 WebRTC 資料通道連線，最多八人，由房主分配錯開雙列格位、固定每台車位置並同步起跑時刻；中途加入／重連不會重排其他人。預備起跑時交通車不能推移格位。多人分岔以房主首先觀察到進入末段 250 公尺的車輛選線為準，鎖定全員下一條支線，分流段平滑引導；單人的自由選路不受影響。畫面及結果頁提供即時名次、進度與斷線狀態。多人玩家彼此目前為不碰撞的 ghost，交通車與路側障礙則有實體碰撞；尚無伺服器權威的玩家間碰撞系統。

配樂使用 20 首約三分鐘的 Suno 雙聲道 MP3，依目前場景自動選曲，也可在設定選擇 20 首手動電台並切回自動。選單、30 條分支、16 個結局與各曲循環有交疊銜接；首次下載失敗時保留原合成音樂，已解碼的完整曲目快取最多保留兩首。音樂共約 82.25 MiB，曲目來源、下載紀錄及音訊分析保存在 `assets/music/`；播放和音效已完成桌面瀏覽器回歸，手機音訊延遲、實測節拍及主觀混音仍需另驗。

碰撞使用公斤質量、相對法向速度、等反向衝量及有限摩擦；中央碰撞不再隨機彈起或旋轉。交通生成與移動會檢查連續可通行空間，避免同一側永久空白的捷徑。手機本地 60 FPS 是目標，桌面瀏覽器或模擬手機視窗的量測不等於手機實機驗證。Godot 保存十車、完整路線、乘員、護欄與平交道基本資料及原生開發程式；新增資料欄位已能解析，但本次 Canvas 新美術、滿舵、連線與道路事件仍須另行移植到原生版本。`exports/` 為本機匯出位置，不納入 Git；舊 debug APK 不代表最新版。

回歸檢查使用 Node.js 內建模組，無需安裝套件：

```sh
node tests/gameplay.test.cjs
node tests/scenery.test.cjs
node tests/traffic.test.cjs
node tests/physics.test.cjs
node tests/geography.test.cjs
node tests/multiplayer.test.cjs
node tests/endings.test.cjs
node tests/road-boundary.test.cjs
node tests/rail-crossing.test.cjs
node tests/road-events.test.cjs
node tests/world-life.test.cjs
```

瀏覽器與真實多人測試（需 Playwright 及 Chromium／Edge；多人測試需可連上公用 PeerJS）：

```sh
node tools/verify-browser.cjs <報告目錄>
node tools/verify-multiplayer.cjs <報告目錄>
node tools/verify-route-soak.cjs <報告目錄> --driver --regular-clock
node tools/verify-road-boundary.cjs <報告目錄>
node tools/verify-crossing-passages.cjs <報告目錄>
node tools/verify-rail-crossing.cjs <報告目錄>
node tools/verify-endings.cjs <報告目錄>
node tools/verify-music-masters.cjs <報告目錄>
```

本輪各測試的範圍、結果、證據位置與尚未實測項目列於 [QA_RELEASE.md](QA_RELEASE.md)。Godot 可另以 `godot --headless --path . --script res://tools/verify-godot-data.gd` 驗證基本資料；這項檢查不代表原生美術或手機效能驗收。

測試涵蓋重新開局、輸入狀態、檢查點與終點計時、分岔、碰撞、連續交通通路、路側淨空、地區地標、多人格位、時間校準及過期封包。`node tools/verify-browser.cjs <報告目錄>` 可用 Playwright／Edge 實測網頁子目錄、實際選車流程、點火動畫、10 車及 31 路段。多人另已用獨立 Edge contexts、公用 PeerJS 與真實 WebRTC 驗證三人位置轉發／重連／再次起跑，以及八人連線與格位；不等同八台手機實機比賽或效能認證。`assets/**/*meta.json` 與 `*.prompt.txt` 保存內建 imagegen 素材的提示詞及來源；第三方程式庫和字型附原授權。

## 獨立新版的網頁發布準備

`.github/workflows/pages.yml` 僅接受手動 `workflow_dispatch`，沒有 push 或 pull request 自動部署。新版倉庫 Settings → Pages 的 Source 為 GitHub Actions，於 Actions 手動執行發布。流程只接受 `main` 分支，原《衝向墾丁》的部署獨立保留。

本機可執行 `node tools/package-pages.cjs`，將網頁需要的 `index.html`、路線腳本、繪圖模組、Three.js、圖片、音樂及字型放進 `_site/`。打包程式保留相對路徑，支援 `/formosa-run/` 專案子目錄；不包含 Godot 原始碼、原生模型、測試、提示詞、生成中繼資料或建置快取。Godot 原始碼與 10 車／31 路線資料仍保留在開發倉庫。輸出資料夾若已存在，程式會停止，避免覆寫其他檔案。

工作流程版本與權限依據 [GitHub Pages 自訂工作流程官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)；手動執行方式見 [GitHub Actions 官方文件](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)。
