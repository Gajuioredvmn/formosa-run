package tw.formosarun.qa;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.KeyguardManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.ParcelFileDescriptor;
import android.os.Handler;
import android.os.Looper;
import android.view.PixelCopy;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

/** Separate signed test APK: never included in the game APK or exposed to JavaScript. */
public final class GameProbe extends Instrumentation {
    private Activity activity;
    private WebView web;
    private final JSONArray checks = new JSONArray();
    private final JSONObject report = new JSONObject();
    private boolean recordVideo;
    @Override public void onCreate(Bundle args) { super.onCreate(args); recordVideo=args!=null&&"true".equals(args.getString("record")); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            Intent launch = new Intent().setClassName("tw.formosarun.game", "tw.formosarun.game.MainActivity")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity = startActivitySync(launch);
            require(!((KeyguardManager)activity.getSystemService(Activity.KEYGUARD_SERVICE)).isKeyguardLocked(), "device_unlocked");
            runOnMainSync(() -> web = findWeb(activity.getWindow().getDecorView()));
            require(web != null, "native_webview_exists");
            // Restrict network only in this test WebView; never change phone Wi-Fi/mobile data.
            runOnMainSync(() -> web.getSettings().setBlockNetworkLoads(true));
            waitFor("Boolean(window.__kr&&document.querySelector('#tap')&&G.bootMs)", 90000);
            require(bool("location.protocol==='https:'&&isSecureContext"), "secure_local_origin");
            require(bool("innerWidth>innerHeight"), "landscape_viewport");
            require(bool("__kr.CARS.length===10&&document.querySelectorAll('#thumbs button').length===10"), "ten_car_menu");
            require(bool("__kr.audioDebug.adapter.diagnostics.tracks.filter(t=>t.status==='ready').length>=20"), "twenty_music_tracks");
            screenshot("01-title");
            tap("#tap"); waitFor("UI.unlocked", 10000);
            require(bool("UI.scr==='title'"), "initial_unlock_does_not_click_through_to_menu");
            screenshot("01a-unlocked");
            waitFor("AU.ctx&&AU.ctx.state==='running'", 10000);
            require(true, "trusted_touch_unlocks_audio");
            tap("#s-title [data-go='select']"); waitFor("UI.scr==='select'", 5000);
            screenshot("02-car-select");
            tap("#s-select [data-act='pick']"); waitFor("UI.scr==='setup'", 5000);
            tap("#seg-auto [data-v='at']");
            tap("#seg-ctrl [data-v='touch']");
            tap("#s-setup [data-act='go']"); waitFor("RACE.state==='ignition'", 6000);
            require(true, "ignition_animation_reached");
            waitFor("Boolean(__kr.IGN.layout&&__kr.IGN.layout.carId===PC.spec.id)", 6000);
            require(bool("__kr.IGN.layout.portraits.length===2&&__kr.IGN.layout.portraits.every((p,i)=>p.ready&&p.name===__kr.CREW[PC.spec.id][i].name)"), "ignition_uses_selected_car_and_two_existing_portraits");
            screenshot("03-ignition");
            waitFor("RACE.state==='run'", 18000);
            require(bool("CTL.mode==='touchforced'&&PC.auto"), "touch_steering_and_auto_gears");
            waitFor("Boolean(__kr.audioDebug.radio&&__kr.audioDebug.radio.status.active&&__kr.audioDebug.radio.status.decoded>0)", 15000);
            require(true, "bundled_mp3_decodes_and_plays");
            report.put("radio", object("__kr.audioDebug.radio.status"));
            // Observe a real-time run without advancing or overriding game physics.
            js("(()=>{window.__phoneFrames=[];let last=performance.now(),end=last+8000;function sample(t){__phoneFrames.push({dt:t-last,v:PC.v*3.6});last=t;if(t<end)requestAnimationFrame(sample)}requestAnimationFrame(sample);return true})()");
            JSONObject gas = object("(()=>{let r=CTL.pads.gas;return{x:r.x+r.w/2,y:r.y+r.h/2,w:innerWidth,h:innerHeight}})()");
            float[] point = nativePoint(gas);
            requireFocus();
            long down = SystemClock.uptimeMillis();
            sendPointerSync(MotionEvent.obtain(down, down, MotionEvent.ACTION_DOWN, point[0], point[1], 0));
            SystemClock.sleep(8300);
            require(bool("CTL.gas>.9||PC.throttle>.9"), "native_touch_holds_throttle");
            screenshot("04-driving");
            sendPointerSync(MotionEvent.obtain(down, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0));
            SystemClock.sleep(300);
            report.put("driving", object("__kr.state()"));
            report.put("frameSample", object("(()=>{let a=__phoneFrames.slice(2),d=a.map(f=>f.dt).sort((a,b)=>a-b);return{frames:a.length,seconds:a.reduce((s,f)=>s+f.dt,0)/1000,meanFps:1000/(a.reduce((s,f)=>s+f.dt,0)/a.length),p50Ms:d[Math.floor(d.length*.5)],p95Ms:d[Math.floor(d.length*.95)],maxSpeedKmh:Math.max(...a.map(f=>f.v)),over33ms:a.filter(f=>f.dt>33.4).length}})()"));
            require(report.getJSONObject("frameSample").getDouble("maxSpeedKmh") > 20, "real_time_touch_acceleration");
            require(bool("CTL.touches.size===0"), "throttle_release_clears_touch");
            // Record separately, so the FPS sample above has no video-encoder load.
            if (recordVideo) {
            requireFocus();
            long recordStart = SystemClock.uptimeMillis();
            ParcelFileDescriptor recording = getUiAutomation().executeShellCommand(
                "screenrecord --time-limit 10 --size 1280x576 --bit-rate 6000000 /sdcard/Android/data/tw.formosarun.game/files/qa/06-driving.mp4");
            down = SystemClock.uptimeMillis();
            sendPointerSync(MotionEvent.obtain(down, down, MotionEvent.ACTION_DOWN, point[0], point[1], 0));
            SystemClock.sleep(10500);
            requireFocus();
            sendPointerSync(MotionEvent.obtain(down, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0));
            SystemClock.sleep(Math.max(0, recordStart + 12000 - SystemClock.uptimeMillis()));
            // Wait for screenrecord to exit before the background test, even
            // if this phone's encoder took longer than usual to initialize.
            try (InputStream output = new ParcelFileDescriptor.AutoCloseInputStream(recording)) {while (output.read() != -1) { }}
            requireFocus();
            report.put("recording", "qa/06-driving.mp4");
            }
            // Actual native activity background / foreground cycle.
            double elapsed = object("({elapsed:RACE.elapsed})").getDouble("elapsed");
            runOnMainSync(() -> activity.moveTaskToBack(true));
            SystemClock.sleep(1800);
            getTargetContext().startActivity(new Intent().setClassName("tw.formosarun.game", "tw.formosarun.game.MainActivity")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
            SystemClock.sleep(1500);
            require(bool("G.paused&&AU.ctx.state==='suspended'"), "background_pauses_game_and_audio");
            double after = object("({elapsed:RACE.elapsed})").getDouble("elapsed");
            require(after - elapsed < .5, "background_does_not_advance_race");
            screenshot("05-return-paused");
            tap("#s-pause [data-act='resume']"); waitFor("!G.paused&&AU.ctx.state==='running'", 6000);
            require(true, "explicit_resume_restores_audio");
            // Leaving the user at the title avoids running an unattended race.
            js("(()=>{__kr.G.paused=true;__kr.show('pause');return true})()");
            tap("#s-pause [data-act='quit']"); waitFor("UI.scr==='title'", 6000);
            runOnMainSync(() -> web.getSettings().setBlockNetworkLoads(false));
            report.put("checks", checks).put("ok", true).put("networkBlockedOnlyInsideTestWebView", true);
            result.putString("report", report.toString());
            finish(Activity.RESULT_OK, result);
        } catch (Throwable e) {
            if(web!=null)try { report.put("failureState",object("(()=>{const e=document.querySelector('#s-title [data-go=select]'),r=e&&e.getBoundingClientRect();return{screen:UI.scr,unlocked:UI.unlocked,innerWidth,innerHeight,devicePixelRatio,rect:r&&{x:r.x,y:r.y,width:r.width,height:r.height},visualViewport:visualViewport&&{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop}}})()")); screenshot("99-failure"); } catch (Throwable ignored) { }
            try { report.put("checks", checks).put("ok", false).put("error", e.toString()); } catch (Exception ignored) { }
            result.putString("report", report.toString());
            finish(Activity.RESULT_CANCELED, result);
        }
    }
    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++) {
            WebView found = findWeb(((ViewGroup) view).getChildAt(i)); if (found != null) return found;
        }
        return null;
    }
    private String js(String source) throws Exception {
        if(web==null)throw new Exception("WebView is not initialized");
        String[] value = {null}; CountDownLatch done = new CountDownLatch(1);
        String wrapped = "(()=>{const k=window.__kr;const G=k&&k.G,UI=k&&k.UI,RACE=k&&k.RACE,PC=k&&k.PC,CTL=k&&k.CTL,AU=k&&k.audioDebug.buses;return (" + source + ");})()";
        runOnMainSync(() -> web.evaluateJavascript(wrapped, v -> {value[0] = v; done.countDown();}));
        if (!done.await(12, TimeUnit.SECONDS)) throw new Exception("JavaScript timed out");
        return value[0];
    }
    private boolean bool(String expression) throws Exception { return "true".equals(js(expression)); }
    private JSONObject object(String expression) throws Exception { return new JSONObject(js(expression)); }
    private void waitFor(String expression, long ms) throws Exception {
        long deadline = SystemClock.uptimeMillis() + ms;
        while (SystemClock.uptimeMillis() < deadline) { if (bool(expression)) return; SystemClock.sleep(200); }
        throw new Exception("Timed out: " + expression);
    }
    private void require(boolean ok, String name) throws Exception {
        checks.put(new JSONObject().put("name", name).put("ok", ok));
        Bundle progress=new Bundle();progress.putString("check",name);progress.putBoolean("ok",ok);sendStatus(1,progress);
        if (!ok) throw new Exception(name);
    }
    private float[] nativePoint(JSONObject p) throws Exception {
        int[] location = new int[2], size = new int[2];
        runOnMainSync(() -> {web.getLocationOnScreen(location); size[0] = web.getWidth(); size[1] = web.getHeight();});
        return new float[]{location[0] + (float)(p.getDouble("x") / p.getDouble("w") * size[0]),
            location[1] + (float)(p.getDouble("y") / p.getDouble("h") * size[1])};
    }
    private void tap(String selector) throws Exception {
        requireFocus();
        JSONObject p = object("(()=>{let e=document.querySelector(" + JSONObject.quote(selector) + ");if(!e)return{};let r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,w:innerWidth,h:innerHeight,rw:r.width,rh:r.height}})()");
        if(p.optDouble("rw",0)<=0||p.optDouble("rh",0)<=0||p.getDouble("x")<0||p.getDouble("y")<0||p.getDouble("x")>=p.getDouble("w")||p.getDouble("y")>=p.getDouble("h"))
            throw new Exception("Touch target is hidden or outside the game viewport: "+selector);
        float[] point = nativePoint(p); long t = SystemClock.uptimeMillis();
        if(!report.has("taps"))report.put("taps",new JSONArray());
        JSONObject touch=new JSONObject().put("selector",selector).put("css",p).put("nativeX",point[0]).put("nativeY",point[1]).put("before",js("UI.scr"));
        report.getJSONArray("taps").put(touch);
        sendPointerSync(MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, point[0], point[1], 0));
        SystemClock.sleep(60);
        sendPointerSync(MotionEvent.obtain(t, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0));
        SystemClock.sleep(200);
        touch.put("after",js("UI.scr"));
    }
    private void screenshot(String name) throws Exception {
        requireFocus();
        int[] size = new int[2];
        runOnMainSync(() -> {size[0]=activity.getWindow().getDecorView().getWidth();size[1]=activity.getWindow().getDecorView().getHeight();});
        Bitmap bitmap = Bitmap.createBitmap(size[0], size[1], Bitmap.Config.ARGB_8888);
        CountDownLatch copied = new CountDownLatch(1); int[] status = {-1};
        // Copy only this application's surface, never the phone's other windows.
        runOnMainSync(() -> PixelCopy.request(activity.getWindow(), bitmap, r -> {status[0]=r;copied.countDown();}, new Handler(Looper.getMainLooper())));
        if (!copied.await(5, TimeUnit.SECONDS) || status[0] != PixelCopy.SUCCESS) {bitmap.recycle();throw new Exception("App surface capture failed: " + status[0]);}
        File dir = new File(getTargetContext().getExternalFilesDir(null), "qa"); dir.mkdirs();
        try (FileOutputStream out = new FileOutputStream(new File(dir, name + ".png"))) { bitmap.compress(Bitmap.CompressFormat.PNG, 100, out); }
        bitmap.recycle();
    }
    private void requireFocus() throws Exception {
        boolean[] focused = {false};
        runOnMainSync(() -> focused[0] = activity.hasWindowFocus());
        if (!focused[0]) throw new Exception("Game lost focus; input/capture skipped to avoid another app");
    }
}
