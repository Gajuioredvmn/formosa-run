// Package the browser game only. Godot sources and art-review material stay local.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function packagePages(output = path.join(ROOT, '_site')) {
  output = path.resolve(output);
  if (fs.existsSync(output)) throw new Error('Output already exists; choose a new directory: ' + output);

  const files = new Set(['index.html', 'data/routes.js',
    'vendor/three.module.js', 'vendor/three.core.js', 'vendor/RoomEnvironment.js', 'vendor/three.LICENSE.txt']);
  function collect(folder, include) {
    for (const item of fs.readdirSync(path.join(ROOT, folder), { withFileTypes: true })) {
      const relative = folder + '/' + item.name;
      if (item.isSymbolicLink()) throw new Error('Symbolic links are not supported: ' + relative);
      if (item.isDirectory()) {
        if (relative !== 'assets/models') collect(relative, include);
      } else if (include(relative)) files.add(relative);
    }
  }
  collect('render', file => /\.(?:js|css)$/.test(file));
  collect('assets', file => /\.(?:png|jpe?g|webp|svg|ttf|woff2?|otf|ogg|mp3|wav)$/.test(file) || file === 'assets/fonts/OFL.txt');

  const ordered = [...files].sort();
  for (const relative of ordered) {
    const source = path.join(ROOT, relative);
    if (!fs.statSync(source).isFile()) throw new Error('Missing web file: ' + relative);
  }
  fs.mkdirSync(output);
  for (const relative of ordered) {
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relative), destination);
  }
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return { output, files: [...ordered, '.nojekyll'], bytes: ordered.reduce((sum, file) => sum + fs.statSync(path.join(ROOT, file)).size, 0) };
}

module.exports = { packagePages };
if (require.main === module) console.log(JSON.stringify(packagePages(process.argv[2]), null, 2));
