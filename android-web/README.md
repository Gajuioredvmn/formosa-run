# 衝向寶島 Android 測試版

這個 APK 內含目前網頁遊戲、圖片、20 首音樂和字型，單人遊戲可離線執行；多人連線需要網路。它使用 Android System WebView 執行相同的 Canvas 遊戲，沒有把舊 Godot 原型當作新美術版本。最低 Android 8，請保持 Android System WebView 更新。尚未在特定手機驗證前，不宣稱穩定 60 FPS。

採用橫向全螢幕，保留瀏海安全邊界、觸控輸入及本機設定。切到背景、來電失去音訊焦點時暫停；回到遊戲後由玩家繼續。返回鍵先暫停比賽，選單上才詢問是否離開。僅需網路權限，不使用相機、麥克風、檔案系統 JavaScript 橋接。

## 建置

需要 Node.js 18+、Python 3.11+、JDK 17、Android SDK `platforms;android-35` 和 `build-tools;35.0.1`。不用 Gradle，也不用額外 Java 函式庫。

```powershell
node android-web/build.cjs --sdk 'C:\Android\Sdk' --jdk 'C:\Java\jdk-17' --python 'C:\Python\python.exe' --output 'D:\builds\formosa-unique-build'
```

輸出路徑必須尚未存在。程式會先複製 `tools/package-pages.cjs` 選定的網頁檔案，只在 APK 複本把 Google Fonts 換成本機相同字型，再編譯 Java、組合資源、對齊、簽章並檢查全部資產 SHA-256。`build-report.json` 保存來源版本、實際內容雜湊及 APK 雜湊；`apk-integrity-report.json` 保存驗證結果。

首次建置會在 `%LOCALAPPDATA%\FormosaRun\signing` 建立專用簽章金鑰與密碼檔（不進 Git，也不放進 APK）。請備份該資料夾，後續更新須沿用同一金鑰。可用 `--signing PRIVATE_DIRECTORY` 指定另一個私人位置。此流程供直接安裝測試；正式商店發行另需設定正式簽章、版本及商店資料。

## 安裝與實機檢查

```powershell
adb devices -l
adb -s DEVICE_SERIAL install -r 'D:\builds\formosa-unique-build\FormosaRun-0.2.1.apk'
adb -s DEVICE_SERIAL shell am start -n tw.formosarun.game/.MainActivity
```

必須在手機開啟 USB 偵錯並接受授權。如果有多個裝置，指定正確序號，不同時覆蓋其他裝置。安裝後應在手機測試選車、啟動引擎、觸控操控、音樂、背景暫停恢復、飛航模式單人及多人連線。桌面瀏覽器檢查不能代替手機 FPS、記憶體與觸控測試。

`qa/` 是獨立的 Android instrumentation 測試套件，使用同一私人簽章金鑰建置，不包含在遊戲 APK。它在已解鎖的測試手機以原生觸控操作選單及油門，確認音樂解碼、背景暫停／恢復，並記錄 8 秒真實遊玩期間的 `requestAnimationFrame` 幀間隔；這只是短時間觀測，不等同持續 60 FPS 保證。測試只阻擋該 WebView 的網路請求，不變更手機 Wi-Fi 或行動網路。測試完成後移除 `tw.formosarun.game.qa`，遊戲會保留。

```powershell
node android-web/qa/build.cjs --sdk 'C:\Android\Sdk' --jdk 'C:\Java\jdk-17' --python 'C:\Python\python.exe' --output 'D:\builds\formosa-qa'
adb -s DEVICE_SERIAL install -r 'D:\builds\formosa-qa\FormosaRun-device-qa.apk'
adb -s DEVICE_SERIAL shell am instrument -w tw.formosarun.game.qa/tw.formosarun.qa.GameProbe
adb -s DEVICE_SERIAL uninstall tw.formosarun.game.qa
```

需要遊戲行駛影片時，在 instrumentation 指令加入 `-e record true`，會另外錄製 10 秒畫面；幀率取樣在錄影前完成，避免影片編碼影響該次測量。測試時讓遊戲維持前景，若切換應用程式會停止後續輸入與截圖。靜態畫面只擷取遊戲視窗；錄影完成後應確認沒有私人通知或其他應用程式才提供給他人。結果圖片及影片位於手機 `Android/data/tw.formosarun.game/files/qa/`，JSON 檢查結果由 instrumentation 輸出。

```powershell
adb -s DEVICE_SERIAL shell am instrument -w -e record true tw.formosarun.game.qa/tw.formosarun.qa.GameProbe
adb -s DEVICE_SERIAL pull /sdcard/Android/data/tw.formosarun.game/files/qa 'D:\builds\formosa-device-results'
```

## 實作依據與字型

- Android [Load in-app content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)：本地資產使用專用 HTTPS origin，避免 `file://` 的來源與權限問題。
- Android [apksigner](https://developer.android.com/tools/apksigner)：先 zipalign 再簽章，最後驗證簽章。
- `fonts/` 中 Press Start 2P 與 Russo One 來自 [Google Fonts](https://github.com/google/fonts)，隨附各自 OFL。中文沿用遊戲既有 Noto Sans TC 及其 OFL。
