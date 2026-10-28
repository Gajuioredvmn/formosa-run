// No Gradle or third-party Java dependencies. Requires JDK 17+, Android SDK 35,
// Node.js 18+ and Python 3.11+. Build output/signing credentials stay outside Git.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const os = require('node:os');
const { packagePages } = require('../tools/package-pages.cjs');
const ROOT = path.resolve(__dirname, '..');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!process.argv[i].startsWith('--') || !process.argv[i + 1]) throw Error('Use --name value arguments');
  options[process.argv[i].slice(2)] = process.argv[i + 1];
}
const sdk = options.sdk || process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
const jdk = options.jdk || process.env.JAVA_HOME;
const python = options.python || 'python';
if (!sdk || !jdk || !options.output) throw Error('Required: --sdk PATH --jdk PATH --output NEW_DIRECTORY [--python PATH]');
const destination = path.resolve(options.output);
if (fs.existsSync(destination)) throw Error('Output already exists; choose a fresh directory: ' + destination);
// Windows Android native tools cannot reliably open non-ASCII paths. Compile
// from an ASCII staging directory, then copy deliverables to the chosen folder.
const stagingParent = path.resolve(options.staging || path.join(os.tmpdir(), 'FormosaRunBuilds'));
if (!/^[\x20-\x7e]+$/.test(stagingParent)) throw Error('Pass --staging with an ASCII-only directory path');
fs.mkdirSync(stagingParent, { recursive: true });
const out = fs.mkdtempSync(path.join(stagingParent, 'build-'));
const ext = process.platform === 'win32' ? '.exe' : '';
const bin = name => path.join(jdk, 'bin', name + ext);
const bt = path.join(sdk, 'build-tools', options['build-tools'] || '35.0.1');
const android = path.join(sdk, 'platforms', 'android-35', 'android.jar');
const env = { ...process.env, JAVA_HOME: jdk };
const run = (exe, args, extra = {}) => {
  const result = cp.spawnSync(exe, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, env, maxBuffer: 8 * 1024 * 1024, ...extra });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw Error(path.basename(exe) + ' failed: ' + (result.error?.message || result.status));
  return result.stdout;
};
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]).sort();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const required of [bin('java'), bin('javac'), android, path.join(bt, 'aapt2' + ext), path.join(bt, 'lib', 'd8.jar')]) {
  if (!fs.existsSync(required)) throw Error('Missing tool: ' + required);
}
run(process.execPath, [path.join(__dirname, 'qa', 'verify-bridge.cjs')]);
for (const d of ['assets', 'classes', 'dex', 'generated']) fs.mkdirSync(path.join(out, d));
fs.cpSync(path.join(__dirname, 'res'), path.join(out, 'res'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'AndroidManifest.xml'), path.join(out, 'AndroidManifest.xml'));
fs.copyFileSync(android, path.join(out, 'android.jar'));
const www = path.join(out, 'assets', 'www');
const packaged = packagePages(www);
const fonts = path.join(__dirname, 'fonts');
const fontChecksums = JSON.parse(fs.readFileSync(path.join(fonts, 'sha256.json'), 'utf8').replace(/^\uFEFF/, ''));
for (const item of fontChecksums) {
  const file = path.join(fonts, item.file);
  if (sha(file) !== item.sha256) throw Error('Bundled font checksum mismatch: ' + item.file);
  fs.copyFileSync(file, path.join(www, 'assets', 'fonts', item.file));
}
const index = path.join(www, 'index.html');
let html = fs.readFileSync(index, 'utf8');
// Package-only change: identical fonts load locally instead of Google Fonts.
// Source index.html, gameplay code and visual assets are not rewritten.
html = html.replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\r?\n?/g, '');
const css = '<style>@font-face{font-family:"Noto Sans TC";src:url("./assets/fonts/NotoSansTC-Regular.ttf") format("truetype");font-weight:100 900;font-display:swap}'
  + '@font-face{font-family:"Russo One";src:url("./assets/fonts/RussoOne-Regular.ttf") format("truetype");font-display:swap}'
  + '@font-face{font-family:"Press Start 2P";src:url("./assets/fonts/PressStart2P-Regular.ttf") format("truetype");font-display:swap}</style>';
html = html.replace('</head>', css + '</head>');
if (html.includes('href="https://fonts.')) throw Error('External font links remain');
fs.writeFileSync(index, html);
run(path.join(bt, 'aapt2' + ext), ['compile', '--dir', path.join(out, 'res'), '-o', path.join(out, 'resources.zip')]);
run(path.join(bt, 'aapt2' + ext), ['link', '-I', path.join(out, 'android.jar'), '--manifest', path.join(out, 'AndroidManifest.xml'),
  '--java', path.join(out, 'generated'), '-o', path.join(out, 'resources.apk'), path.join(out, 'resources.zip')]);
run(bin('javac'), ['-encoding', 'UTF-8', '-source', '8', '-target', '8', '-classpath', android, '-d', path.join(out, 'classes'),
  ...walk(path.join(__dirname, 'src')).filter(f => f.endsWith('.java'))]);
run(bin('java'), ['-cp', path.join(bt, 'lib', 'd8.jar'), 'com.android.tools.r8.D8', '--lib', android, '--min-api', '26',
  '--output', path.join(out, 'dex'), ...walk(path.join(out, 'classes')).filter(f => f.endsWith('.class'))]);
run(python, [path.join(__dirname, 'assemble.py'), out]);
run(path.join(bt, 'zipalign' + ext), ['-p', '-f', '4', path.join(out, 'unsigned.apk'), path.join(out, 'aligned.apk')]);

const signing = path.resolve(options.signing || path.join(process.env.LOCALAPPDATA || process.env.HOME || out, 'FormosaRun', 'signing'));
if (signing.toLowerCase() === ROOT.toLowerCase() || signing.toLowerCase().startsWith(ROOT.toLowerCase() + path.sep))
  throw Error('Keep signing keys outside the Git repository');
const key = path.join(signing, 'formosa-run.jks');
const passwordFile = path.join(signing, 'store-password.txt');
fs.mkdirSync(signing, { recursive: true });
if (fs.existsSync(key) !== fs.existsSync(passwordFile)) throw Error('Signing key/password pair is incomplete; restore its backup, do not replace it.');
if (!fs.existsSync(key)) {
  fs.writeFileSync(passwordFile, crypto.randomBytes(36).toString('base64url'), { mode: 0o600, flag: 'wx' });
  env.FORMOSA_APK_STORE_PASS = fs.readFileSync(passwordFile, 'utf8').trim();
  run(bin('keytool'), ['-genkeypair', '-keystore', key, '-storepass:env', 'FORMOSA_APK_STORE_PASS', '-keypass:env', 'FORMOSA_APK_STORE_PASS',
    '-alias', 'formosa-run', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Formosa Run Local Builds', '-noprompt']);
} else env.FORMOSA_APK_STORE_PASS = fs.readFileSync(passwordFile, 'utf8').trim();
const apk = path.join(out, 'FormosaRun-0.2.1.apk');
const apksigner = ['-jar', path.join(bt, 'lib', 'apksigner.jar')];
run(bin('java'), [...apksigner, 'sign', '--ks', key, '--ks-key-alias', 'formosa-run', '--ks-pass', 'env:FORMOSA_APK_STORE_PASS',
  '--key-pass', 'env:FORMOSA_APK_STORE_PASS', '--out', apk, path.join(out, 'aligned.apk')]);
delete env.FORMOSA_APK_STORE_PASS;
const signingReport = run(bin('java'), [...apksigner, 'verify', '--verbose', '--print-certs', apk]);
fs.writeFileSync(path.join(out, 'signing-verification.txt'), signingReport);
run(path.join(bt, 'zipalign' + ext), ['-c', '4', apk]);
const badging = run(path.join(bt, 'aapt' + ext), ['dump', 'badging', apk]);
fs.writeFileSync(path.join(out, 'apk-badging.txt'), badging);
const report = {
  createdAt: new Date().toISOString(), apk: path.join(destination, path.basename(apk)), package: 'tw.formosarun.game', version: '0.2.1',
  bytes: fs.statSync(apk).size, sha256: sha(apk), sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  sourceDirty: cp.execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim().length > 0,
  sourceIndexSha256: sha(path.join(ROOT, 'index.html')), packagedIndexSha256: sha(index),
  packageOnlyTransforms: ['Google Fonts URLs replaced with bundled OFL font faces'],
  contentFiles: walk(www).map(file => ({ path: path.relative(www, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: sha(file) })),
  wrapperSources: [path.join(__dirname, 'AndroidManifest.xml'), ...walk(path.join(__dirname, 'src')), ...walk(path.join(__dirname, 'res'))]
    .map(file => ({ path: path.relative(__dirname, file).replaceAll('\\', '/'), sha256: sha(file) })),
  sourceWebBytes: packaged.bytes, androidApi: { min: 26, target: 35 },
  note: 'Local WebView game; phone performance and multiplayer require physical-device verification.'
};
fs.writeFileSync(path.join(out, 'build-report.json'), JSON.stringify(report, null, 2));
run(python, [path.join(__dirname, 'verify.py'), apk, path.join(out, 'build-report.json')]);
fs.mkdirSync(destination, { recursive: true });
for (const name of ['FormosaRun-0.2.1.apk', 'build-report.json', 'apk-integrity-report.json', 'signing-verification.txt', 'apk-badging.txt'])
  fs.copyFileSync(path.join(out, name), path.join(destination, name));
// Keep the exact packaged web directory for browser/asset verification.
fs.cpSync(www, path.join(destination, 'www'), { recursive: true });
if (path.dirname(out) !== stagingParent || !path.basename(out).startsWith('build-')) throw Error('Refusing unsafe staging cleanup');
fs.rmSync(out, { recursive: true });
console.log(JSON.stringify({ apk: report.apk, bytes: report.bytes, sha256: report.sha256, files: report.contentFiles.length, signingDirectory: signing }, null, 2));
