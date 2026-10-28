// Before installing a previously built candidate, verify that its game files
// and native wrapper still match the working tree, including uncommitted fixes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Usage: node android-web/qa/verify-current.cjs BUILD_DIRECTORY');
const report=JSON.parse(fs.readFileSync(path.join(dir,'build-report.json'),'utf8'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const mismatches=[];
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(sha(Buffer.from(index))!==report.sourceIndexSha256)mismatches.push('source index.html');
const css='<style>@font-face{font-family:"Noto Sans TC";src:url("./assets/fonts/NotoSansTC-Regular.ttf") format("truetype");font-weight:100 900;font-display:swap}'
  +'@font-face{font-family:"Russo One";src:url("./assets/fonts/RussoOne-Regular.ttf") format("truetype");font-display:swap}'
  +'@font-face{font-family:"Press Start 2P";src:url("./assets/fonts/PressStart2P-Regular.ttf") format("truetype");font-display:swap}</style>';
const packaged=index.replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\r?\n?/g,'').replace('</head>',css+'</head>');
if(sha(Buffer.from(packaged))!==report.packagedIndexSha256)mismatches.push('packaged index.html');
for(const item of report.contentFiles){
  if(item.path==='index.html')continue;
  if(item.path==='.nojekyll'&&item.bytes===0)continue;
  let file=path.join(root,item.path);
  const localFont=path.join(root,'android-web/fonts',path.basename(item.path));
  if(item.path.startsWith('assets/fonts/')&&fs.existsSync(localFont))file=localFont;
  if(!fs.existsSync(file)||sha(fs.readFileSync(file))!==item.sha256)mismatches.push(item.path);
}
for(const item of report.wrapperSources){
  const file=path.join(root,'android-web',item.path);
  if(!fs.existsSync(file)||sha(fs.readFileSync(file))!==item.sha256)mismatches.push('android-web/'+item.path);
}
const result={ok:mismatches.length===0,gameFiles:report.contentFiles.length,wrapperFiles:report.wrapperSources.length,mismatches};
console.log(JSON.stringify(result,null,2));
if(!result.ok)process.exitCode=1;
