"""Bundle the static app and its worker into one HTML; no build dependencies."""
from pathlib import Path
import re
import json
project = Path(__file__).resolve().parents[1]
root = project / 'dist'


def read_js(name):
    text = (root / name).read_text()
    text = re.sub(r'^import .*?;\s*$', '', text, flags=re.M)
    return re.sub(r'\bexport\s+(?=(?:const|function|class)\b)', '', text)


runner = (project / 'scripts' / 'portable-runner.js').read_text()
runner = re.sub(r'^import .*?;\s*$', '', runner, flags=re.M)
runner = re.sub(r'\bexport\s+(?=class\b)', '', runner)
app = read_js('app.js').replace("new Worker('./worker.js',{type:'module'})", 'new PortableRunner()')
code = ('(()=>{\n' + read_js('core.js') + '\n' + read_js('charts.js') +
        '\n' + runner + '\n' + app + '\n})();')
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>' + (root / 'style.css').read_text() + '</style>')
html = html.replace('<script type="module" src="./app.js"></script>', '<script>' + code + '</script>')
html = html.replace('href="./"', 'href="#"')
html = html.replace('理想同步 · AWGN</span>', '本地体验 · 无需登录</span>')
output = project / 'CommScope-Lab.html'
output.write_text(html)
print(f'Built {output.name}: {output.stat().st_size} bytes')
