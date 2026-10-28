package tw.formosarun.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Hosts exactly the packaged game on a secure, app-private web origin. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";
    // The game's variables live inside an ES module. Use its exported interface,
    // and the existing blur handler to release pedals/steering, not global names.
    private static final String PAUSE = "(()=>{window.dispatchEvent(new Event('blur'));const k=window.__kr;if(!k)return;"
        + "if(k.G.mode==='play'&&!k.UI.resultShown){k.G.paused=true;k.show('pause');}"
        + "const a=k.audioDebug.buses;if(a.ctx)a.ctx.suspend();})()";
    private WebView web;
    private FrameLayout frame;
    private AudioManager audio;
    private AudioFocusRequest focus;
    private boolean leaving;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowManager.LayoutParams window = getWindow().getAttributes();
        window.preferredRefreshRate = 60f;
        getWindow().setAttributes(window);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.rgb(18, 12, 42));
        setContentView(frame);
        if (Build.VERSION.SDK_INT >= 30) {
            frame.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.displayCutout());
                v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        }
        audio = (AudioManager) getSystemService(AUDIO_SERVICE);
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            .setOnAudioFocusChangeListener(change -> {
                if (change <= AudioManager.AUDIOFOCUS_LOSS && web != null) web.evaluateJavascript(PAUSE, null);
            }).build();
        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::showPauseOrExit);
        createGame();
    }

    @SuppressWarnings("deprecation") private void immersive() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController control = getWindow().getInsetsController();
            if (control != null) {
                control.hide(WindowInsets.Type.systemBars());
                control.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @SuppressWarnings("deprecation") private void createGame() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(18, 12, 42));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportZoom(false);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    Log.e("FormosaRun", m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if (!HOST.equals(uri.getHost())) return null;
                if (!"https".equals(uri.getScheme()) || !"GET".equals(req.getMethod())) return error(403, "Forbidden");
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/")) return error(404, "Not Found");
                String relative = path.substring(8);
                for (String part : relative.split("/", -1)) {
                    if (part.isEmpty() || part.equals(".") || part.equals("..") || part.indexOf('\\') >= 0 || part.indexOf('\0') >= 0)
                        return error(403, "Forbidden");
                }
                try {
                    InputStream data = getAssets().open("www/" + relative);
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    headers.put("X-Content-Type-Options", "nosniff");
                    return new WebResourceResponse(mime(relative), textFile(relative) ? "UTF-8" : null,
                        200, "OK", headers, data);
                } catch (IOException e) {
                    Log.e("FormosaRun", "Missing packaged asset: " + relative);
                    return error(404, "Not Found");
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !"https".equals(req.getUrl().getScheme()) || !HOST.equals(req.getUrl().getHost());
            }
            @Override public void onPageFinished(WebView view, String url) {
                Log.i("FormosaRun", "Local game loaded: " + url);
                immersive();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError error) {
                if (req.isForMainFrame() && !leaving) new AlertDialog.Builder(MainActivity.this)
                    .setTitle("遊戲載入失敗").setMessage("請更新 Android System WebView 後再試一次。")
                    .setPositiveButton("重試", (d, w) -> web.loadUrl(START)).setNegativeButton("離開", (d, w) -> finish()).show();
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                frame.removeView(view);
                view.destroy();
                web = null;
                Log.e("FormosaRun", "Renderer stopped; didCrash=" + detail.didCrash());
                if (!leaving) new AlertDialog.Builder(MainActivity.this).setTitle("遊戲已停止")
                    .setMessage(detail.didCrash() ? "遊戲繪圖程序意外停止，可以重新開啟；本次比賽需重新開始。"
                        : "系統停止了遊戲繪圖程序。可以關閉其他應用程式後重新開啟；本次比賽需重新開始。")
                    .setPositiveButton("重新開啟", (d, w) -> createGame()).setNegativeButton("離開", (d, w) -> finish()).show();
                return true;
            }
        });
        frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
        web.loadUrl(START);
    }

    private static boolean textFile(String p) { return p.matches(".*\\.(html|js|css|json|svg|txt)$"); }
    private static String mime(String p) {
        String ext = p.substring(p.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "html": return "text/html";
            case "js": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            case "mp3": return "audio/mpeg";
            case "ogg": return "audio/ogg";
            case "wav": return "audio/wav";
            case "ttf": return "font/ttf";
            case "otf": return "font/otf";
            case "woff": return "font/woff";
            case "woff2": return "font/woff2";
            case "txt": return "text/plain";
            default: return "application/octet-stream";
        }
    }
    private static WebResourceResponse error(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason,
            new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.resumeTimers(); web.onResume(); }
        if (audio != null) audio.requestAudioFocus(focus);
        immersive();
    }
    @Override protected void onPause() {
        if (web != null) { web.evaluateJavascript(PAUSE, null); web.onPause(); web.pauseTimers(); }
        if (audio != null) audio.abandonAudioFocusRequest(focus);
        super.onPause();
    }
    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) immersive();
    }
    @Override public void onBackPressed() {
        showPauseOrExit();
    }
    private void showPauseOrExit() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(()=>{const k=window.__kr;if(k&&k.G.mode==='play'){" + PAUSE + ";return true;}return false;})()", result -> {
            if (!"true".equals(result) && !leaving) new AlertDialog.Builder(this).setTitle("離開衝向寶島？")
                .setPositiveButton("離開", (d, w) -> finish()).setNegativeButton("繼續", null).show();
        });
    }
    @Override protected void onDestroy() {
        leaving = true;
        if (web != null) { frame.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
