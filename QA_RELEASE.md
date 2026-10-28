# 《衝向寶島》工作區整合驗收

日期：2026-10-25。這份報告記錄本輪可重現的檢查與限制，對象是預設 Canvas 網頁版及 Godot 共用基本資料。各項結果依其證據檔的測試時間記錄；最終逐章節畫面巡查、發布包驗證與正式發布由主代理整合，尚未以本報告宣告所有裝置皆無 bug 或商業發行完成。

## 本輪實作範圍

- 10 台車獨立後視像素圖、選車人物像、原班底 19 位人物與一隻狗；各車獨立滿舵、回正及慶祝呈現，頭髮／頭紗／圍巾等依車速與受力產生有阻尼的擺動。
- 270 列邏輯座標、540 列實際畫布，道路與車圖提高取樣密度；保留原追車比例、道路推進、油門、煞車與轉向參數。
- 車流新增適合港區寬路的重型車、重機、群體事件與預告後落下的貨物，保留連續可通行車道。
- 水岸、農田、廣場等路緣有可見且連續的護欄或矮牆；景點清空不再留下可以穿越的邊界。
- 集集以連續瀝青路面、緩坡、橫向鐵道、燈鈴柵欄和橋下替代道路銜接；列車時序與通道保留一併檢查。
- 31 段地景配置、路側淨空、高山地形與樹種調整；16 個終點獨立風景圖、160 組三段角色故事。
- 多人錯開雙列起跑、每輪點火、重連、即時排名、分岔路線鎖定。房主首次觀察到進入分岔末段的選線決定全員下一段，避免各玩家跑到不同路線後失去對戰。
- 20 首 Suno 實際 MP3 已接入自動場景配樂及手動電台，分支、選單、結局與循環以交疊銜接。引擎、換檔、擦撞及掠過聲音保留並重新驗證。

## 已通過的檢查

| 範圍 | 結果與實際測法 | 主要重跑工具 |
| --- | --- | --- |
| JavaScript 語法 | 87 個程式檔、1 段 HTML 內嵌腳本與 1 組 import map 解析通過 | `node --check`、`vm.Script` |
| Node 整合單元測試 | 77 個 Node 測試入口全過；部分入口內含 gameplay 19 項、physics 8 項、traffic 14 項等既有套件 | `node --test tests/*.test.cjs` |
| 原版操控數值 | 10 車 × 8 情境 × 600 步，共 1,104,000 個欄位值與保留原版相同，最大差異 0 | `tools/verify-driving-contract.cjs` |
| 完整五關行程 | 16 條路線使用正常觸控轉向與油門／煞車輸入，原始 95 秒計時及檢查點加時，全數完成；333.5–361.5 秒，零卡死／零堵死採樣 | `tools/verify-route-soak.cjs --driver --regular-clock` |
| 道路實體邊界 | 窄通口修正後重跑 31 段每 2m 左右共 144,080 點；40,916 個水岸／懸崖類點、21,002 個農作類點均有對應可見邊界 | `tools/verify-road-boundary.cjs` |
| 高速撞邊 | 31 段 × 10 車 × 兩側，620 次以 50m/s 向外滿舵，零穿出；最大逐幀橫移 0.136m | 同上 |
| 人／動物窄通口 | 171 處雙側 1.45m 開口與端柱，10 項瀏覽器檢查通過；四牛、四山豬、兩處黑熊、22 段行人及側向機車實際橫越無穿欄、保留車道並完成離場；每個開口 × 10 車 × 雙側 × 3 位置共 10,260 次邊界解析零越界 | `tools/verify-crossing-passages.cjs` |
| 集集平交道 | 20 個閘門／旁路檢查、10 車 × 4 列車時序情境全部通過，1,120 次通道採樣皆可行 | `tools/verify-rail-crossing.cjs` |
| 全部結局 | 16 終點 × 10 車，桌面和窄視窗共 320 組畫面；1,122 項人物、文字、三段對話與回標題檢查通過 | `tools/verify-endings.cjs` |
| 車輛與人物美術 | 86 項圖集、角色對應、選車 UI／手機視窗檢查通過 | `tools/verify-vehicle-art.cjs` |
| 車身／人物動作 | 31 項受力、各車動作及局部布料／髮絲呈現檢查通過 | `tools/verify-vehicle-motion.cjs` |
| 實際音樂 | 20 首雙聲道 MP3 全數解碼，119 項檢查通過；30 分支＋16 結局＋2 選單＋20 循環共 68 次交疊，未檢出 100ms 掉音或削波；實際點擊選台、回自動、暫停／恢復、音量及首次 404 回退通過，完整解碼快取最多兩首 | `tools/verify-music-masters.cjs` |
| 引擎與音效 | 新音樂整合後 26 項音效回歸通過 | `tools/verify-audio.cjs` |
| 換檔聲音 | 13 項波形、自排、H 檔與循序檔檢查通過 | `tools/verify-shift-audio.cjs` |
| 道路事件 | 19 項實際瀏覽器檢查：牛／山豬群體、慢行與電子花車、貨物預告和落地動作等 | `tools/verify-road-events.cjs` |
| 樹冠／建物淨空 | 31 段配置檢查及問題場景截圖，9 項瀏覽器驗證與 17 項地景單元檢查通過；最後樹圖已接入，遠樹樹根須有地表承托，7 位行人的 4 幀步態共 28 組實際選圖皆正確 | `tools/verify-scenery-setbacks.cjs`、`tests/scenery.test.cjs` |
| 多人真實傳輸 | 較早美術版本 51 項通過；獨立 Edge contexts、公用 PeerJS、原生 WebRTC，2／3／8 人、重開局、重連、容量拒絕、排名、分岔；分流引導 62 次採樣未越過道路邊界。10/25 新美術與記憶體修改後的八人重跑中斷，尚無通過報告 | `tools/verify-multiplayer.cjs` |
| 觸控操作 | 較早版本 32 項通過；10/25 記憶體／鐵路／水岸修改後的新版也已重跑 32 項通過，詳見下方 mobile-memory-final；皆為瀏覽器手機尺寸觸控模擬 | `tools/verify-mobile.cjs` |
| 繪圖密度 | 10/24 當次地景修正後，6 場景確認實際 540 列畫布、道路光柵及 2× transform；桌面 Edge 160 幀中位 19.7ms、p95 29ms | `tools/verify-detail-renderer.cjs` |
| 正常速度遊戲影片 | 高雄港／合歡山／枋山各約 10 秒，960×540 H.264 MP4，總長 30.642 秒；每段遊戲時間約 10.1 秒、實際牆鐘約 10.02 秒，原計時和碰撞，零 JS／缺檔錯誤；無聲畫面預覽 | `tools/record-gameplay-preview.cjs`、`tools/remux-preview.py` |
| Godot 基本資料 | 10 車、31 段、16 終點、451 個合併邊界區間、171 處窄通口、1 個集集平交道可解析；四個原生腳本可實例化 | `tools/export-data.cjs`、`tools/verify-godot-data.gd` |
| Godot 專案 | Godot 4.7.2 無介面編輯器匯入及主場景 120 幀啟動，退出碼 0，未出現解析／資源錯誤 | `--headless --editor --import --quit`、`--quit-after 120` |

完整行程的 QA 駕駛器只送入正常玩家控制；不在途中瞬移、改車速、移除車流或延長計時。加速執行時，碰撞冷卻使用模擬時間，避免因測試執行速度改變撞車判定。10 台車分布在 16 條行程中，並非全部 160 種車型／完整路線組合都逐一通關。

Node 單元測試另涵蓋點火、輸入釋放、重開局、檢查點／終點期限、分岔、碰撞恢復、動量與能量、跟車／變道、世界行人／車圖及結局資料。整合過程找出的兩個 `world-life` 舊 Canvas mock 已更新為目前使用的 transform／制動燈 API；不藉停用斷言掩蓋失敗。

## 證據與重跑方式

本機完整輸出位於 `../formosa-work/full-qa-20261024/`，車輛細項位於 `../formosa-work/vehicle-art-20261024/`。證據不混入網頁發布包。

| 證據 | 相對於 `full-qa-20261024/` 的路徑 |
| --- | --- |
| 遊戲整合摘要 | `gameplay/qa-summary-current.json` |
| 16 路線行程及過程取樣 | `gameplay/routes-after-passages/route-soak-report.json` |
| 邊界及高速撞邊 | `gameplay/boundary-after-passages/road-boundary-report.json` |
| 使用者錄影對應場景 | `gameplay/road-boundary-video-regressions/s3w.png`、`s4f.png` |
| 橫越窄通口與動物／行人離場 | `gameplay/crossing-passages/crossing-passages-report.json` |
| 列車及旁路 | `gameplay/rail-after-boundary/rail-crossing-report.json` |
| 正式結局及畫面 | `gameplay/endings-after-boundary/endings-report.json` |
| 操控原版對照 | `gameplay/driving-contract-after-passages.json` |
| 全套 Node 測試 | `gameplay/all-unit-final.log` |
| Godot 資料／匯入／啟動 | `gameplay/godot-data-report.json`、`godot-import-final.log`、`godot-start-final.log` |
| 繪圖密度與桌面時序 | `release-preview/detail-report.json` |
| 正常速度實機畫面 | `release-preview/gameplay-preview-30s-final.mp4`、`gameplay-preview-report.json` |
| 多人及分流邊界 | `network-mobile/final-boundary-live/live-report.json` |
| 手機視窗／H 檔輸入 | `network-mobile/hgate-mobile/report.json` |
| 實際音樂與音效 | `../suno-production/actual-master-qa/report.json`、`../suno-production/audio-regression-final/report.json`、`../suno-production/shift-regression-final/report.json` |
| 地景退縮及遮擋 | `network-mobile/scenery-identity-final/scenery-setbacks-report.json` |

Node 及 Godot 範例（瀏覽器工具需 Playwright 與 Edge／Chromium）：

```sh
node --test tests/*.test.cjs
node tools/verify-route-soak.cjs <報告目錄> --driver --regular-clock
node tools/verify-road-boundary.cjs <報告目錄>
node tools/verify-crossing-passages.cjs <報告目錄>
node tools/verify-rail-crossing.cjs <報告目錄>
node tools/verify-endings.cjs <報告目錄>
node tools/verify-multiplayer.cjs <報告目錄>
node tools/verify-music-masters.cjs <報告目錄>
node tools/export-data.cjs
godot --headless --path . --editor --import --quit
godot --headless --path . --script res://tools/verify-godot-data.gd
```

## 2026-10-25 地景、地理與鹽田增補驗證

這次增補修正通用地標標籤借用其他縣市名稱的問題。岡山／橋頭／路竹與臺南、彰化／臺中／苗栗、高雄大樹／高屏溪／屏東依實際路段顯示所在地；北港、九份、南寮、南庄、石梯坪等改用各自的老街、港口、風箏或吊橋名稱。全 31 路段的實際生成路牌共 46 項瀏覽器檢查通過；道路長度、彎道、坡度、車道寬、分岔與計時數據未變。

西螺紅色鋼桁架橋、龍騰紅磚斷橋、九份茶樓階巷與石梯坪海蝕平台已經從無效標籤補成可見景觀，包含九份紅燈籠商家。四種剪影獨立，僅在指定地區出現，完整外框至少退道路 6m；龍騰清出前方視線，石梯坪底部埋入岸地，九份前庭保留花台與人群。實際圖集／路段／腳邊淨空 10 項檢查通過，並檢視遠近距離截圖。原圖、生成提示與官方外觀來源保存在 `assets/pixel/regional-art-provenance.json`。這些是縮放過的遊戲景觀，不是測繪模型。

七股鹽田改為原生世界座標格池：16m × 24m 的矩形池、灰褐乾堤及淺水，少數池格包含瓦盤／結晶鹽面；池面高樹移除，低灌草限於乾堤，七股鹽山仍是獨立的白色鹽堆地標。鹽田 7 項實際瀏覽器檢查、4 項原生光柵單元檢查通過；同次地景／地理單元合計 27 項通過。五個受影響路段（s3w／s4f／s4g／s5n／s5p）重跑 10 車 × 兩側，共 100 次 50m/s 撞邊零穿出；全 31 段 144,080 個道路邊界採樣皆有相應可見阻擋。所有瀏覽器依序啟動並在各次測試後關閉。

鹽田的淺水／蒸發／結晶分區依據[雲嘉南濱海國家風景區七股鹽業介紹](https://www.swcoast-nsa.gov.tw/zh-tw/accommodation/details/223)及[井仔腳瓦盤鹽田介紹](https://www.swcoast-nsa.gov.tw/zh-tw/attraction/details/000369)整理；遊戲格池尺寸及分布為美術配置，未宣稱復刻現址測量。

增補證據：`gameplay/geography/geography-report.json`、`gameplay/regional-art/regional-art-report.json`、`gameplay/salt-fields/salt-fields-report.json`、`gameplay/regional-salt-boundary/road-boundary-report.json`。這輪未再次全量重跑音訊、跨網路多人或手機實體效能；前表的完整行程與效能是各自記錄時間的結果。

植被替換與後續地景檢查分別保留證據，不把不同版本的檢查數量合併成一次測試：

| 增補項目 | 已測結果 | 證據路徑 |
| --- | --- | --- |
| 20 種細像素植被 | 32 項實際瀏覽器檢查；48 個舊別名已換新圖，保留世界高度、根錨、風擺與實際碰撞直徑；19 個既有家族實際進入道路配置，新增蕨類已註冊 | `gameplay/vegetation/vegetation-report.json`、`vegetation-catalog.png` |
| 根部乾地／橋面／高海拔 | 21 項實際瀏覽器檢查；全 31 段 68,341 棵一般樹的完整根半徑無落水、橋面無樹，合歡山上段 36% 之後無高樹；該次地景與世界單元合計 24 項通過 | `../landscape-review-20261024/final-system/report.json` |
| 地區建築剪影 | 7 張圖集、75 個舊別名；9 項實際瀏覽器檢查及 2 項單元檢查通過，原世界尺寸、錨點和碰撞保持不變 | `../landscape-review-20261024/landmarks-marine-final/landmark-art-report.json` |
| 四個新增地方景觀 | 10 項瀏覽器檢查；各自圖形、地區、透明邊緣、接地與路面退縮；13 張實景與圖鑑留存 | `gameplay/regional-art/regional-art-report.json`、`regional-catalog.png` |
| 鹽田格池 | 7 項實際瀏覽器檢查、4 項光柵單元檢查；三個實際行駛位置截圖 | `gameplay/salt-fields/salt-fields-report.json`、`salt-18.png`、`salt-50.png`、`salt-78.png` |
| 大佛基座／太魯閣岩壁 | 5 項實際瀏覽器檢查；八卦山大佛基座回到地面 y=0；岩壁改用 28m 視覺分段，補透視三角缺口與接縫；全部 31 段道路座標、曲率、寬度及碰撞紀錄不變 | `../cliff-review-20261025/after/report.json`、同目錄 `sample-*.png` |
| 直幹棕櫚 | 6 項實際瀏覽器檢查；8,079 根既有棕櫚的根位置、尺寸、翻轉與風相位一致；城街 3,333 根採直幹，海岸 3,777 根直幹／969 根自然彎曲，高山轉換後無棕櫚；31 段道路與碰撞 hash 不變 | `../upright-palms-20261025/report.json` |
| 道路樹影／建築投影 | 2 項 Node 單元檢查通過；向陽側真實樹木及上層建物投影限制在路幅內，對岸／過遠物件不投影；重複物件不加倍變黑 | `tests/road-lighting.test.cjs`（專案路徑；`node --test tests/road-lighting.test.cjs`） |
| 圖集記憶體 | 單頁實機 6 項通過；1,170 個 sprite 的數值 ID、世界尺寸、碰撞與每個像素保持一致，92 個同圖別名共用矩形；編譯後釋放五模組原圖，31 段道路／擺放／邊界 hash 不變；記憶體單元新增 8 項，連同 world-life／landmark 共 16 項通過 | `network-mobile/scenery-release/diagnostics/memory-art-final/memory-art-report.json` |

圖集去重前後的單頁開機測量另存於 `network-mobile/scenery-release/diagnostics/memory-baseline/boot-memory-report.json` 與 `network-mobile/scenery-release/diagnostics/memory-after/boot-memory-report.json`，正式對照表為 `network-mobile/scenery-release/diagnostics/memory-comparison.json`：圖集 RGBA 估計 426.66 → 319.99 MiB，公開模組保留原圖估計 192.01 → 30.01 MiB，GC 後瀏覽器程序 private bytes 約 1670.07 → 1553.33 MiB。RGBA 估計不是 GPU 實際配置量，公開模組清單也不含所有閉包內資產；測試未認證低記憶體手機可用性，也未證明先前當機原因已排除。

新版背景、分層遠景、地表與樹種已接入，最終每章節逐張目視巡查及發布包回歸仍由主代理收斂。上述本地桌面 headless 測試不等於手機 60fps 實機驗證；地景修改後的另一輪桌面採樣中位為 17.7–29.2ms、p95 為 24.7–43.4ms，存在場景與負載波動。前表較早的效能數字保留為歷史，不挑其中較快者當成新版效能保證。

### 10/25 逐章節巡查後的局部修正

主代理已輸出全 31 段共 316 個章節中點畫面，該次載入沒有 JavaScript 錯誤或遺失資產。第一組人工巡查涵蓋 `sections-00.png` 至 `sections-08.png` 的 108 格：s1、s2n、s3w、s4a、s5a、s5b、s4f、s5k、s5l、s3m 全部章節，以及 s4b 前四章節。可疑處另開原尺寸圖確認，沒有把縮圖巡查當成動態測試。

逐項發現與修正證據保存在 `../release-20261025/scenes-all-sections/review-00-08.json`。北港近距離陣頭的前後遮擋由主代理修正；`../release-20261025/depth-order/depth-report.json` 的 4 項檢查包含 10 車 × 31 路段共 310 次繪圖，以及近人／遠人與玩家車的畫序和隱藏狀態，頁面錯誤為零。

- 集集 section-04 的高牆來自平交道旁的真實擋土結構；原先分隔線設在道路中心，已改為左側單車道支線，保留至少 3.9m 支線與至少 7m 地下道。原道路中心維持地面高度，10 台車均可從中心通過；封閉時左側柵欄仍阻擋車輛。牆面保留其高度，加上板縫、排水基腳及反光片。
- 阿里山 section-05 取消整條柏油路轉為縱向雙鐵軌的配置；維持原本 480m 長度、兩車道、坡度、彎度及路肩，左側 5.1–8.9m 的獨立路權放置軌道與紅色森林列車，護欄分隔公路。現有 31 路段不再使用舊 `track:true` 行車表面。
- 北門魚塭修正灰綠水面被誤當乾地的像素判斷，水岸地形遮住樹根時整棵隱藏，避免遠棕櫚只剩截斷樹幹懸在池面。這是可見承托修正，沒有改變原道路操控參數。

最終局部瀏覽器報告 `../release-20261025/section-review-final/section-review-report.json` 共 24 項通過；其中含 10 車 × 中心地下道／封閉平交道的 20 次實際物理檢查。另以四個不同列車相位各駕駛 28 秒、使用正常計時器，112 次前方通道採樣全部可通行。此為集集局部行駛，不宣稱重跑了全部 16 組完整行程。相關 rail／scenery 單元 30 項通過；同目錄 10 張實景包含 `jiji-centre.png`、`jiji-local-open.png`、`alishan-middle.png`、`beimen-pond-bank.png`，最終單頁測試無 JavaScript 錯誤或遺失資產且已關閉。

另一組景物修正的 `../release-20261025/final-scene-fixes/report.json` 有 8 項通過、6 張人工核視圖：南庄客家屋按完整寬度退道路、日月潭咖啡屋移到乾岸、岸地灌木／紅樹林／蘆葦不進入深水，以及台東路線分區地名。`manual-review.json` 保留逐圖結論；該組 scenery／landmark 單元 23 項通過。最新兩頁 WebRTC 煙霧測試 `../release-20261025/online-smoke/live-report.json` 為 32 項通過、清理及頁面錯誤皆為零；它沒有補齊新版八人重測或跨網路驗證。

記憶體、鐵路及水岸修正後，再以單一瀏覽器／context／page 執行手機尺寸觸控回歸，`../release-20261025/mobile-memory-final/report.json` 為 32 項通過、零頁面錯誤及遺失資產。涵蓋實際觸控事件的完整點火／重新開始／雙指操作、AT／MT H 檔／誤觸取消／空檔、橫直方向切換與八名次 HUD 排版；八名次是版面測試資料，並非八人 WebRTC 實測。瀏覽器與伺服器已正常關閉。這是桌面 Edge 的手機尺寸與觸控模擬，仍不能宣稱 Android／iPhone 實機手感、記憶體或 60fps。

以上靜態畫面不能判斷轉向動畫連續性、每個地標的所有視角、所有碰撞組合或跨實體裝置表現。最新完整發布包、逐章節最終收斂及 GitHub Pages 上線仍由主代理驗收。Godot 共用資料的出口已加入新的平交道側向 `axis`，解析檢查也驗證它保留主道路中心及至少 4.6m 淨高；主代理已於 10/25 重新匯出並完成 Godot 4.7.2 匯入、資料驗證與主場景 120 幀啟動，退出碼皆為 0。

地方配置採官方觀光及自然地理資料核對，仍有遊戲化路程壓縮。例如太魯閣路線以長春祠作終點，燕子口後抵達長春祠的行程序列未呈現真實返程；不可把遊戲當成實際導航或道路開放資訊。

## 10/25 發布成品驗證

最終 77/77 Node 測試通過；87 個程式檔及 HTML 內嵌腳本、import map 解析通過。正式成品於 `/formosa-run/` 子目錄的 55/55 檢查通過，涵蓋實際選單、10 車、31 路線、點火、倒數、原操控與輸入釋放，0 程式錯誤、0 缺失資源。報告為 `all-unit-final.log`、`syntax-final.json` 與 `packaged-smoke-final/browser-report.json`。

- 對完整 31 路線的 316 個章節畫面逐張巡查；修正後另拍 31 × 3 = 93 張畫面，沒有 JavaScript 錯誤或缺失資源。人工審閱與已知修正保存在 `release-20261025/scenes-all-sections/`、`scenes-final/` 及局部回歸資料夾。
- 最後 93 張回歸另找到南庄遠景一般客家屋的可見基座缺口，已加上限於該類建物的接地檢查；3/3 聚焦檢查通過，兩處近屋與全 31 路段道路／碰撞雜湊保持一致，修正後重新打包並完成上述 55 項成品檢查。證據為 `hakka-foundations-final/`。
- 原操控重跑 10 車 × 8 情境 × 600 步 × 23 欄位，共 1,104,000 值與保留的原始引擎一致，最大差異 0；此數值比較不含本輪刻意修改的碰撞、事件與護欄。
- Godot 共用資料重新匯出：10 車、31 路線、16 終點、451 邊界區間、171 窄通口、1 個集集平交道。匯入、解析與主場景 120 幀啟動均通過，原生美術／連線同等功能仍未完成。
- 最新正常速度錄影含高雄港、合歡山與枋山，各約 10 秒，保留原計時、車流與碰撞。每段遊戲經過約 10.1 秒、實際經過約 10.02 秒；0 JS／缺檔錯誤。靜音 H.264 MP4 全長 30.501 秒，以封裝轉換保留原幀時間，未加速。
- 成品檔案清單包含 20 首音樂及新增像素素材；來源與 QA 證據保留在 Git 倉庫或本地工作資料夾，發布包不包含測試工具、暫存和 Godot 編輯器快取。未發現超過 GitHub 100 MiB 單檔限制的資產。

本輪具體證據根目錄為 `../formosa-work/release-20261025/`。各項檢查只證明其記錄範圍，不代表任意手機、網路或未測操作均不會出錯。

## 2026-10-29 樹木閃爍、乘員慣性與 Android 增補

- 樹木縮圖改為保留 alpha 覆蓋率的取樣，不再逐層加黑邊；移除依大小切換鏡像，固定物件朝向。樹根改查實際地表材質覆蓋率，不再用受波浪／霧／陰影影響的 RGB 判斷。6 路段各 180 幀共 1,080 幀、95,262 次繪圖中，沒有鏡像切換，也沒有高度超過 20 邏輯像素或實際 alpha 超過 .25 的快速消失再出現；極遠處接近透明的物件仍可能被剔除。9 組縮圖切換樣本的平均 RGB 差由 11.395 降至 2.476。畫外樹根 20–28 像素另補連續淡入回歸。
- 髮根、短髮、長髮、圍巾及頭紗改用分開的慣性與氣流狀態；風壓隨車速平方增加，急煞有前甩再回擺，停車衰減。修正重疊頭髮遮罩會拖動圍巾綁點，僅加密人物區域網格並貼合接縫。61 項實際車輛繪圖／乘員動作檢查與 6 項慣性單元檢查通過；ROSSO、BAMBOO、ORO 各 8 秒正常控制輸入，約 200–260 km/h 開始，經左右轉向與急煞停車。錄影以 60Hz 遊戲步進、15fps 輸出，清空車流以隔離動作；不拿此片當作效能或美術品質認證。
- 音樂校準 +3dB，持續引擎／風聲約 -3.7dB，未改音量滑桿與靜音。18 項實際 MP3 加引擎的混音量測通過，相對配樂平衡增加約 6.66dB，量測峰值最高 .65，靜音為零；手機喇叭的主觀平衡仍需玩家確認。
- 一般教學及路況字幕不再顯示，必要通知／加時移至左上單行，分岔牌避開暫停按鈕及名次。貨物的路面「!」及危險範圍保留。14 項實際 HUD／站體檢查與 24 張近距離畫面通過。
- 同區輕軌站的舊圖像近側實際越過路緣 3.13m，改成沿路 20m × 3.4m 的平台、頂棚及 6 柱，圖像和碰撞使用同一位置。美麗島入口本身未重現侵入車道；完整屋頂、四柱及平台另行驗證。
- 撞擊依正撞／側撞／擦撞分流；車子沿撞擊後橫向速度滑移再由摩擦減速，足夠的低位側向衝量才抬輪，之後落地回正。固定物正撞不再在動畫期間高速穿過。12 項物理、19 項 gameplay、8 項實際碰撞與 10 台車繪圖檢查通過；這是接地側傾與滑移，未完成 360 度翻滾所需的全角度圖像。
- 最新 18 套 Node 檢查共 154 項通過；10 車 × 8 情境的 1,104,000 個正常駕駛欄位值與保留的《衝向墾丁》相同。另以兩個獨立瀏覽器 context、公用 PeerJS 與原生 WebRTC 重跑 16 項：錯位起跑、點火、實際油門前進、名次、正負側撞傾角同步與恢復。沒有重跑八台手機或跨網路矩陣。
- Android 新增相同 Canvas 遊戲的離線 WebView 封裝，包含 122 個網頁資產、20 首音樂及離線字型；逐檔 SHA、v2/v3 簽章、ZIP 對齊及正式版關閉 WebView debugging 均通過。10 項原生暫停橋接回歸使用實際 ES module 的 `__kr` 介面，避免誤讀不存在的全域變數。實機結果依下方增補及交付報告為準，不因 APK 可安裝就宣稱穩定 60fps。

本機證據在 `../formosa-work/fix-20261028/scenery-release/`，其餘在 `../formosa-work/fixes-20261028/` 的 `vehicle-motion-final-weld/`、`cloth-driving-wind-final/`、`mix-balance/`、`hud-stations/`、`multiplayer-release/`、`release-unit/high-speed-wind/`；撞擊證據在 `../formosa-work/fix-20261028/crash-release/`。APK 建置證據在 `../formosa-work/android-20261029/`。較早報告保留原日期與範圍，不代表已覆蓋本次所有新變更。

最終 APK `FormosaRun-0.2.1.apk` 已安裝到使用者授權的 ASUSAI2501C，亦存於手機 Download；SHA-256 為 `b293f1400b96628d2babd940587d18669054267f44a06e4b2884686b0aa7d84a`，建置證據在 `android-20261029/release-input-fixed/`。手機初輪已通過本地 HTTPS、橫向、10 車／20 曲清單與觸控解鎖音訊等 7 項，並實際抓出首次 `pointerdown` 提前顯示選單，導致放手時誤點連線對戰的問題；改在 `click` 釋放後解鎖，新增按下／抬起回歸，桌面 57 項檢查通過。前一候選 APK 的 `www` 也完成 55 項成品檢查，無 JS／缺檔錯誤。最終版手機完整駕駛、背景暫停／恢復、實際 MP3 解碼、FPS 及錄影仍未完成：修補安裝後先遇到鎖定，解鎖後使用者已在其他 App，故停止自動操作。沒有實機 60fps 的通過數據。Godot 共用 JSON 重新匯出並通過 10 車、31 段、16 終點、451 邊界、171 窄通口與 1 處平交道解析；這不等於新行為已移植至 Godot 原生版。

網頁版 `108674df35a8f48aa8c0dc935936b5c9d9c216ad` 已由 GitHub Actions [40757334555](https://github.com/Gajuioredvmn/formosa-run/actions/runs/40757334555) 發布成功；公開網站的 `index.html` 與 6 個變更繪圖／音效模組均以 SHA-256 對照工作樹一致。證據為 `fixes-20261028/published-report.json`。後續只有報告／測試工具變更時，不需要重建相同內容的遊戲。

## 待完成及未實測範圍

- **音訊量測限制**：20 首正式音檔共 86,245,119 bytes（約 82.25 MiB），每首 179.16–180.00 秒，來源、下載與分析紀錄保存在 `assets/music/`。已測解碼、RMS／峰值、交疊連續性及桌面播放流程；尚未認證實測 BPM、調性、LUFS、節拍同步、手機聲音延遲或不同喇叭／耳機的主觀混音。生成要求的 BPM／調性不是實際量測值。
- **實體手機與 60fps**：尚未在 Android／iPhone 實機測試溫度、持續效能、記憶體、感應器、耗電或觸控手感。桌面 Edge 的中位時序較佳，但 p95 已超過 16.7ms；不能據此宣稱穩定手機 60fps。
- **跨網路多人**：目前多個瀏覽器共用同一台桌機和網路。尚未完成不同 NAT／行動網路／跨國延遲／封包遺失／瀏覽器休眠復原矩陣，也未實測 Safari／iOS。
- **玩家碰撞**：遠端玩家仍為 ghost；本輪沒有實作伺服器權威的玩家互撞、防作弊或競賽公平性認證。
- **Godot 與 App**：已更新基本資料並通過解析及啟動；新像素美術、所有道路事件、邊界行為、多人與新音樂尚未全部移植到原生程式。舊原生畫面和 debug APK 不代表本輪完成品，也沒有新的手機原生 60fps 結果。
- **美術完整度**：車圖以後視為主；31 段、316 個章節取樣畫面已人工巡查，修正後另取 93 張全路線畫面回歸。完整全方向車身、所有連續動態視角與商業美術驗收尚未完成。生成素材的來源／提示詞資料保留於各 `*provenance.json` 及 endings 中繼資料。
- **影像證據版次**：上述 30 秒影片及 19.7ms／29ms 桌面繪圖時序保留作 10/24 當時版本的證據；10/25 新背景、地表、植被、地方地標與鹽田以增補章節的截圖／報告為準，10/25 最新正常速度影片為 `release-20261025/video/gameplay-preview-final.mp4`，30.501 秒、960×540，另有 93 張全路線回歸截圖。影片無聲，音訊另行測試。
- **發布**：本輪發布檔以 `tools/package-pages.cjs` 產生獨立成品，再以 `/formosa-run/` 子目錄實測。部署狀態與所屬提交以 GitHub Actions 的「手動發布《衝向寶島》網頁」結果為準。

通過上述案例只表示已測行為符合斷言；新裝置、不同網路或未覆蓋的操作組合仍可能發現問題。
