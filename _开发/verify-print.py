from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import pymupdf as fitz
import zipfile, json, hashlib, os

p = Path(__file__).parent / "测试输出"
q = p / "PDF排版"
q.mkdir(exist_ok=True)
doc = fitz.open(p / "教程打印验证.pdf")
font_path = os.environ.get("PDF_QA_FONT")
if not font_path and Path("C:/Windows/Fonts/msyh.ttc").exists():
    font_path = "C:/Windows/Fonts/msyh.ttc"
font = (
    ImageFont.truetype(font_path, 18) if font_path else ImageFont.load_default(size=18)
)
for i, page in enumerate(doc, 1):
    page.get_pixmap(matrix=fitz.Matrix(1, 1)).save(q / f"page-{i:02d}.png")
for n in range((len(doc) + 5) // 6):
    im = Image.new("RGB", (1260, 1220), "#cbd4d8")
    d = ImageDraw.Draw(im)
    for k in range(6):
        page = n * 6 + k + 1
        if page > len(doc):
            break
        pic = Image.open(q / f"page-{page:02d}.png")
        pic.thumbnail((410, 578))
        x = (k % 3) * 420
        y = (k // 3) * 610
        im.paste(pic, (x, y + 24))
        d.text((x + 6, y + 2), f"Page {page}", font=font, fill="black")
    im.save(q / f"overview-{n+1}.jpg")
with zipfile.ZipFile(p / "交付包验证.zip") as z:
    assert z.testzip() is None
    manifest = json.loads(z.read("manifest.json"))
    project = json.loads(z.read("project.keyboard-project.json"))
    assert manifest["readyForManufacture"] is False
    assert z.read("engineering/F001-测试样件.bin") == bytes([0, 1, 2, 128, 255])
    for f in project["engineeringFiles"]:
        if f["contentBase64"] is not None:
            assert (
                hashlib.sha256(
                    z.read("engineering/" + f["id"] + "-" + f["name"])
                ).hexdigest()
                == f["sha256"]
            )
    print(
        "ZIP verified",
        len(z.namelist()),
        "files",
        "layout",
        manifest["layoutVersionId"],
        "tutorial",
        manifest["tutorialVersionId"],
    )
bad = []
for i, page in enumerate(doc, 1):
    if not page.get_text().strip():
        bad.append({"page": i, "problem": "empty"})
    for block in page.get_text("blocks"):
        x0, y0, x1, y1 = block[:4]
        if x0 < -1 or x1 > page.rect.width + 1 or y0 < -1 or y1 > page.rect.height + 1:
            bad.append({"page": i, "problem": "bounds", "bbox": block[:4]})
report = {
    "pages": len(doc),
    "textCharacters": sum(len(x.get_text()) for x in doc),
    "replacementCharacters": sum(x.get_text().count(chr(65533)) for x in doc),
    "boundsIssues": bad,
    "zipValid": True,
}
(p / "打印与ZIP验证.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8"
)
print(report)
