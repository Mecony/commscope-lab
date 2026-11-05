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


worker = read_js('core.js') + '\n' + read_js('worker.js')
literal = json.dumps(worker, ensure_ascii=False).replace('</', '<\\/')
app = read_js('app.js').replace("new Worker('./worker.js',{type:'module'})", 'new Worker(sweepWorkerUrl)')
code = ('(()=>{\n' + read_js('core.js') + '\n' + read_js('charts.js') +
        '\nconst sweepWorkerUrl=URL.createObjectURL(new Blob([' + literal +
        '],{type:"text/javascript"}));\n' + app + '\n})();')
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>' + (root / 'style.css').read_text() + '</style>')
html = html.replace('<script type="module" src="./app.js"></script>', '<script>' + code + '</script>')
html = html.replace('href="./"', 'href="#"')
output = project / 'CommScope-Lab.html'
output.write_text(html)
print(f'Built {output.name}: {output.stat().st_size} bytes')
