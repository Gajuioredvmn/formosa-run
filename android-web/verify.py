"""Verify every shipped game file against the build manifest, not just ZIP existence."""
import hashlib
import json
import pathlib
import sys
import zipfile

apk = pathlib.Path(sys.argv[1])
report = json.loads(pathlib.Path(sys.argv[2]).read_text('utf-8'))
with zipfile.ZipFile(apk) as z:
    names = z.namelist()
    assert len(names) == len(set(names)), 'Duplicate archive entries'
    assert z.testzip() is None, 'Corrupt archive'
    assert 'classes.dex' in names and 'AndroidManifest.xml' in names
    assert not any(s in name.lower() for name in names for s in ['.jks', '.keystore', 'store-password', '.git/'])
    for item in report['contentFiles']:
        content = z.read('assets/www/' + item['path'])
        assert len(content) == item['bytes'], item['path']
        assert hashlib.sha256(content).hexdigest() == item['sha256'], item['path']
    music = [n for n in names if n.startswith('assets/www/assets/music/') and n.endswith('.mp3')]
    assert len(music) >= 20, f'Only {len(music)} music tracks'
    for font in ['NotoSansTC-Regular.ttf', 'PressStart2P-Regular.ttf', 'RussoOne-Regular.ttf']:
        assert 'assets/www/assets/fonts/' + font in names
    index = z.read('assets/www/index.html').decode('utf-8')
    assert 'href="https://fonts.' not in index
    assert './render/pixel-cars.js' in index and './render/audio.js' in index
    result = {'ok': True, 'gameFilesVerified': len(report['contentFiles']), 'musicTracks': len(music),
              'allFontsOffline': True, 'noSigningSecrets': True, 'duplicateEntries': 0}
pathlib.Path(sys.argv[2]).with_name('apk-integrity-report.json').write_text(json.dumps(result, indent=2), 'utf-8')
print(json.dumps(result))
