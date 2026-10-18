"""One-time import of the existing 32-page tutorial; never edits its PDF."""

from pathlib import Path
from PIL import Image
import json, base64, hashlib, io, argparse

root = Path(__file__).parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--source",
    type=Path,
    required=True,
    help="原教程工作文件目录，内含 tutorial_content.json",
)
parser.add_argument("--pdf", type=Path, required=True, help="原教程 PDF，用于来源哈希")
args = parser.parse_args()
source = args.source
pdf = args.pdf
book = json.loads((source / "tutorial_content.json").read_text(encoding="utf8"))
# Keep general knowledge active; design-specific historical statements remain in
# each chapter's explicitly labelled original reference section, in full.
fixed = {
    1: [3],
    2: [1, 2, 3, 4],
    3: [1, 2],
    4: [0, 1, 2, 3],
    5: [0, 3, 4, 5],
    6: [3],
    7: [],
    8: [1, 3],
    9: [3, 4],
    10: [],
    11: [2, 3, 4],
    12: [2, 3, 4, 5],
    13: [1, 4, 5],
    14: [1, 2, 3, 4, 5, 6],
    15: [0, 1, 2, 3, 4, 5, 6],
    16: [1],
    17: [],
    18: [],
    19: [],
    20: [0, 1, 2, 4, 5, 6, 9],
    21: [],
    22: [2, 3, 4],
    23: [2, 3, 5, 7],
    24: [0, 1, 5, 8],
    25: [4, 5, 6],
    26: [1, 2, 3, 4],
    27: [1, 2, 3],
    28: [0, 1, 2, 3],
    29: [0, 1, 2, 3],
    30: list(range(8)),
    31: list(range(5)),
    32: list(range(6)),
}
deps = {
    1: ["identity", "geometry", "topology", "controller"],
    2: [],
    3: ["topology", "controller", "matrix", "gpio", "oled", "rgb"],
    4: [],
    5: ["controller", "topology", "specs", "toolchain"],
    6: ["inventory", "specs", "rgb"],
    7: ["controller", "matrix", "gpio", "specs", "rgb", "toolchain", "encoders"],
    8: ["geometry"],
    9: ["matrix", "topology"],
    10: ["matrix", "gpio", "controller"],
    11: ["gpio", "controller", "specs", "topology", "rgb"],
    12: ["mechanical", "gpio", "matrix", "specs", "files:pcb"],
    13: ["mechanical", "files:case", "files:plate"],
    14: ["specs", "topology"],
    15: ["gpio", "controller", "specs", "rgb", "topology"],
    16: ["controller", "gpio", "toolchain", "files:firmware"],
    17: ["controller", "toolchain"],
    18: ["matrix", "gpio", "controller", "toolchain", "oled", "rgb"],
    19: ["functions", "matrix", "topology"],
    20: ["functions"],
    21: ["encoders", "encoderSpecs"],
    22: ["oled", "displaySpecs", "controller"],
    23: ["oled", "layers"],
    24: ["rgb", "controller"],
    25: [
        "controller",
        "toolchain",
        "functions",
        "matrix",
        "gpio",
        "oled",
        "rgb",
        "files:firmware",
    ],
    26: ["mechanical", "specs", "files:case", "files:plate"],
    27: [
        "geometry",
        "topology",
        "matrix",
        "gpio",
        "functions",
        "oled",
        "rgb",
        "toolchain",
    ],
    28: [],
    29: [],
    30: [],
    31: ["files:all"],
    32: [],
}
domains = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: ["bom"],
    7: ["schematic"],
    8: ["case", "plate"],
    9: ["matrix"],
    10: ["gpio", "matrix"],
    11: ["schematic"],
    12: ["pcb"],
    13: ["case", "plate"],
    14: [],
    15: [],
    16: ["qmk"],
    17: ["qmk"],
    18: ["qmk"],
    19: ["qmk"],
    20: ["qmk"],
    21: ["qmk"],
    22: ["qmk"],
    23: ["qmk"],
    24: ["qmk"],
    25: ["qmk"],
    26: ["case"],
    27: [],
    28: [],
    29: [],
    30: [],
    31: [],
    32: [],
}
deps[6].append("controller")
deps[10] += ["encoders", "directInputs", "oled", "rgb"]
deps[12].append("controller")
deps[14].append("controller")
deps[27] += ["specs", "controller"]
deps[31] = ["files:all", "artifactStatus"]
titles = {
    1: "当前键盘 DIY 教程与设计快照",
    6: "当前物料与原始 BOM 核对",
    7: "设计审查与未确认事项",
    8: "当前布局与机械尺寸",
    10: "当前引脚与逻辑矩阵对照",
    18: "当前固件配置与版本适配",
    19: "当前四层键位与输入映射",
    21: "当前旋钮与转盘的处理",
    22: "当前 OLED 接线与测试",
    24: "当前 RGB 数据链与供电核对",
    31: "工程归档与制作交付",
}
chapters = []
assets = {}
for n, (title, blocks) in enumerate(book, 1):
    chapters.append(
        {
            "id": f"ch{n:02d}",
            "title": titles.get(n, title),
            "originalTitle": title,
            "sourcePage": n,
            "dependsOn": deps[n],
            "domains": domains[n],
            "principles": [blocks[i] for i in fixed[n]],
            "referenceBlocks": blocks,
            "figures": [b for b in blocks if b[0] == "fig"],
            "templateSteps": [],
        }
    )
    for b in blocks:
        if b[0] != "fig" or b[1] in assets:
            continue
        p = source / b[1]
        im = Image.open(p).convert("RGB")
        im.thumbnail((1400, 1000))
        buf = io.BytesIO()
        if p.suffix.lower() == ".jpg":
            im.save(buf, format="JPEG", quality=84, optimize=True)
            mime = "image/jpeg"
        else:
            im.save(buf, format="PNG", optimize=True)
            mime = "image/png"
        data = buf.getvalue()
        assets[b[1]] = {
            "dataUri": f"data:{mime};base64," + base64.b64encode(data).decode(),
            "sha256": hashlib.sha256(data).hexdigest(),
            "sourceSha256": hashlib.sha256(p.read_bytes()).hexdigest(),
            "width": im.width,
            "height": im.height,
        }
library = {
    "id": "keyboard-diy-tutorial-library",
    "version": "2.0.0",
    "sourcePdf": pdf.name,
    "sourcePdfSha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
    "sourcePages": 32,
    "chapters": chapters,
    "assets": assets,
    "provenance": "原教程全部32章正文与15幅原图保留；principles 只选通用原理与检查，referenceBlocks 保留完整历史原文。",
}
(root / "tutorial-library.json").write_text(
    json.dumps(library, ensure_ascii=False, separators=(",", ":")), encoding="utf8"
)
(root / "教程章节.json").write_text(
    json.dumps(
        {k: v for k, v in library.items() if k != "assets"},
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf8",
)
(root / "教程图片.json").write_text(
    json.dumps({"assets": assets}, ensure_ascii=False, separators=(",", ":")),
    encoding="utf8",
)
print(
    "Imported",
    len(chapters),
    "chapters,",
    len(assets),
    "images; bytes",
    (root / "tutorial-library.json").stat().st_size,
)
