import os
import io
from datetime import date
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from backend.database import get_db

_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/ttf-dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/usr/local/share/fonts/DejaVuSans.ttf",
    os.path.expanduser("~/Library/Fonts/DejaVuSans.ttf"),
    "C:/Windows/Fonts/DejaVuSans.ttf",
    os.path.join(os.path.dirname(__file__), "DejaVuSans.ttf"),
    os.path.join(os.path.dirname(__file__), "fonts", "DejaVuSans.ttf"),
]
_BOLD_CANDIDATES = [p.replace("DejaVuSans.ttf", "DejaVuSans-Bold.ttf") for p in _FONT_CANDIDATES]

FONT_PATH = next((p for p in _FONT_CANDIDATES if os.path.exists(p)), None)
FONT_BOLD = next((p for p in _BOLD_CANDIDATES if os.path.exists(p)), None)
USE_DEJAVU = FONT_PATH is not None and FONT_BOLD is not None

FONT_NORMAL = "DejaVu" if USE_DEJAVU else "Helvetica"
FONT_BOLD_NAME = "DejaVu-Bold" if USE_DEJAVU else "Helvetica-Bold"

CAT_COLORS = {
    "critical": colors.HexColor("#ef4444"),
    "repair":   colors.HexColor("#f97316"),
    "watch":    colors.HexColor("#eab308"),
    "normal":   colors.HexColor("#22c55e"),
}

PDF_TEXT = {
    "ru": {
        "title": "Аналитический отчёт",
        "subtitle1": "о техническом состоянии гидротехнических сооружений",
        "subtitle2": "Жамбылской области",
        "asof": "по состоянию на",
        "footer": "РГП «Казводхоз» · Цифровой каталог ГТС",
        "page": "Стр.",
        "s1": "1. Сводные показатели",
        "m_total": "Всего объектов на учёте",
        "m_risk": "Средний индекс риска",
        "m_kpd": "Средний фактический КПД",
        "m_age": "Средний возраст сооружений",
        "m_critical": "Аварийное состояние",
        "m_repair": "Требуют ремонта",
        "m_watch": "Под наблюдением",
        "m_normal": "Исправное состояние",
        "summary": "Из {total} сооружений {problem} ({pct}%) требуют первоочередного вмешательства — ремонта или аварийного восстановления.",
        "s2": "2. Объекты в аварийном состоянии",
        "no_critical": "Объектов в аварийном состоянии не выявлено.",
        "th_num": "№", "th_name": "Наименование", "th_year": "Год",
        "th_age": "Возраст", "th_risk": "Риск", "th_insp": "Осмотр до",
        "more": "…и ещё {n} объектов в полной базе данных.",
        "s3": "3. План ближайших осмотров",
        "s3_desc": "Объекты с ближайшими сроками технического осмотра.",
        "th_date": "Дата осмотра", "th_state": "Состояние",
        "footer2": "Отчёт сформирован автоматически · Цифровой каталог ГТС",
        "cat_critical": "Аварийное", "cat_repair": "Требует ремонта",
        "cat_watch": "Наблюдение", "cat_normal": "Исправное",
        "no_font_warn": "Шрифт DejaVu не найден. Установите: sudo apt install fonts-dejavu-core",
    },
    "kz": {
        "title": "Аналитикалык есеп",
        "subtitle1": "гидротехникалык курылыстардын техникалык жай-куйи туралы",
        "subtitle2": "Жамбыл облысы",
        "asof": "жагдай бойынша",
        "footer": "«Казсушаруа» РМК · ГТК цифрлык каталогы",
        "page": "Бет",
        "s1": "1. Жиынтык корсеткiштер",
        "m_total": "Есепте туран барлык нысандар",
        "m_risk": "Орташа кауiп индексi",
        "m_kpd": "Орташа накты ПЭК",
        "m_age": "Курылыстардын орташа жасы",
        "m_critical": "Апаттык жагдай",
        "m_repair": "Жондеудi кажет етедi",
        "m_watch": "Бакылауда",
        "m_normal": "Жарамды жагдай",
        "summary": "{total} курылыстын {problem} ({pct}%) бiрiншi кезектегi жондеудi немесе апаттык калпына келтiрудi кажет етедi.",
        "s2": "2. Апаттык жагдайдагы нысандар",
        "no_critical": "Апаттык жагдайдагы нысандар аныкталмады.",
        "th_num": "N", "th_name": "Атауы", "th_year": "Жыл",
        "th_age": "Жасы", "th_risk": "Кауiп", "th_insp": "Тексеру",
        "more": "…жане тагы {n} нысан толык деректер базасында.",
        "s3": "3. Жакын тексерулер жоспары",
        "s3_desc": "Кауiп индексi негiзiнде есептелген техникалык тексерудiн ен жакын мерзiмдерi.",
        "th_date": "Тексеру кунi", "th_state": "Жай-куйi",
        "footer2": "Есеп автоматты турде жасалды · ГТК цифрлык каталогы",
        "cat_critical": "Апаттык", "cat_repair": "Жондеудi кажет етедi",
        "cat_watch": "Бакылау", "cat_normal": "Жарамды",
        "no_font_warn": "DejaVu шрифтi табылмады. Орнату: sudo apt install fonts-dejavu-core",
    },
    "en": {
        "title": "Analytical Report",
        "subtitle1": "on the technical condition of hydraulic structures",
        "subtitle2": "Zhambyl region",
        "asof": "as of",
        "footer": "RSE Kazvodkhoz · Digital catalog of hydraulic structures",
        "page": "Page",
        "s1": "1. Summary indicators",
        "m_total": "Total objects registered",
        "m_risk": "Average risk index",
        "m_kpd": "Average actual efficiency",
        "m_age": "Average age of structures",
        "m_critical": "Critical condition",
        "m_repair": "Need repair",
        "m_watch": "Under monitoring",
        "m_normal": "Operational",
        "summary": "Of {total} structures, {problem} ({pct}%) require priority repair or emergency restoration.",
        "s2": "2. Objects in critical condition",
        "no_critical": "No objects in critical condition found.",
        "th_num": "No.", "th_name": "Name", "th_year": "Year",
        "th_age": "Age", "th_risk": "Risk", "th_insp": "Inspect by",
        "more": "…and {n} more objects in the full database.",
        "s3": "3. Upcoming inspections plan",
        "s3_desc": "Objects with nearest technical inspection dates, calculated from risk index.",
        "th_date": "Inspection date", "th_state": "Condition",
        "footer2": "Auto-generated report · Digital catalog of hydraulic structures",
        "cat_critical": "Critical", "cat_repair": "Needs repair",
        "cat_watch": "Monitoring", "cat_normal": "Operational",
        "no_font_warn": "DejaVu font not found. Fix: sudo apt install fonts-dejavu-core",
    },
}


def _register_fonts():
    if USE_DEJAVU and "DejaVu" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("DejaVu", FONT_PATH))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_BOLD))


def _styles():
    _register_fonts()
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("RuTitle", fontName=FONT_BOLD_NAME, fontSize=20,
                         leading=26, alignment=TA_CENTER, spaceAfter=6))
    s.add(ParagraphStyle("RuSub", fontName=FONT_NORMAL, fontSize=11,
                         leading=15, alignment=TA_CENTER, textColor=colors.grey, spaceAfter=4))
    s.add(ParagraphStyle("RuH2", fontName=FONT_BOLD_NAME, fontSize=14,
                         leading=18, spaceBefore=16, spaceAfter=8))
    s.add(ParagraphStyle("RuBody", fontName=FONT_NORMAL, fontSize=10,
                         leading=14, alignment=TA_LEFT))
    s.add(ParagraphStyle("RuCell", fontName=FONT_NORMAL, fontSize=8, leading=10))
    s.add(ParagraphStyle("RuCellB", fontName=FONT_BOLD_NAME, fontSize=8, leading=10))
    s.add(ParagraphStyle("RuWarn", fontName=FONT_NORMAL, fontSize=9,
                         leading=12, textColor=colors.HexColor("#f97316")))
    return s


def _fetch_report_data():
    conn = get_db()
    metrics = dict(conn.execute("""
        SELECT COUNT(*) total,
          ROUND(AVG(risk_score), 3)        avg_risk,
          ROUND(AVG(efficiency_actual), 3) avg_kpd,
          ROUND(AVG(age), 1)               avg_age,
          SUM(CASE WHEN category='critical' THEN 1 ELSE 0 END) critical,
          SUM(CASE WHEN category='repair'   THEN 1 ELSE 0 END) repair,
          SUM(CASE WHEN category='watch'    THEN 1 ELSE 0 END) watch,
          SUM(CASE WHEN category='normal'   THEN 1 ELSE 0 END) normal
        FROM objects
    """).fetchone())
    for k in ("avg_risk", "avg_kpd", "avg_age"):
        if metrics[k] is None:
            metrics[k] = 0.0

    critical = [dict(r) for r in conn.execute("""
        SELECT o.name, o.year_built, o.age, o.risk_score,
               o.next_inspection_date, d.name AS district_name
        FROM objects o LEFT JOIN districts d ON o.district_id = d.id
        WHERE o.category = 'critical' ORDER BY o.risk_score DESC
    """).fetchall()]

    upcoming = [dict(r) for r in conn.execute("""
        SELECT o.name, o.category, o.risk_score, o.next_inspection_date,
               d.name AS district_name
        FROM objects o LEFT JOIN districts d ON o.district_id = d.id
        WHERE o.next_inspection_date IS NOT NULL
        ORDER BY o.next_inspection_date ASC LIMIT 15
    """).fetchall()]

    conn.close()
    return metrics, critical, upcoming


def _safe(val, fmt="{}", fallback="--"):
    try:
        if val is None:
            return fallback
        return fmt.format(val)
    except Exception:
        return fallback


def generate_report(lang: str = "ru") -> bytes:
    if lang not in PDF_TEXT:
        lang = "ru"
    T = PDF_TEXT[lang]
    cat_labels = {
        "critical": T["cat_critical"], "repair": T["cat_repair"],
        "watch": T["cat_watch"], "normal": T["cat_normal"],
    }

    metrics, critical, upcoming = _fetch_report_data()
    s = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2*cm, rightMargin=2*cm)
    story = []

    def header_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT_NORMAL, 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(2*cm, 1*cm, T["footer"])
        canvas.drawRightString(A4[0]-2*cm, 1*cm, f"{T['page']} {doc.page}")
        canvas.restoreState()

    if not USE_DEJAVU:
        story.append(Paragraph(T["no_font_warn"], s["RuWarn"]))
        story.append(Spacer(1, 0.3*cm))

    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(T["title"], s["RuTitle"]))
    story.append(Paragraph(T["subtitle1"], s["RuSub"]))
    story.append(Paragraph(T["subtitle2"], s["RuSub"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(f"{T['asof']} {date.today().strftime('%d.%m.%Y')}", s["RuSub"]))
    story.append(Spacer(1, 0.8*cm))

    story.append(Paragraph(T["s1"], s["RuH2"]))
    summary_rows = [
        [T["m_total"],    _safe(metrics["total"])],
        [T["m_risk"],     _safe(metrics["avg_risk"],  "{:.0%}")],
        [T["m_kpd"],      _safe(metrics["avg_kpd"],   "{:.0%}")],
        [T["m_age"],      _safe(metrics["avg_age"],   "{:.0f}")],
        [T["m_critical"], _safe(metrics["critical"])],
        [T["m_repair"],   _safe(metrics["repair"])],
        [T["m_watch"],    _safe(metrics["watch"])],
        [T["m_normal"],   _safe(metrics["normal"])],
    ]
    t = Table(summary_rows, colWidths=[10*cm, 5*cm])
    t.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (-1, -1), FONT_NORMAL),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("LINEBELOW",     (0, 0), (-1, -1), 0.3, colors.HexColor("#dddddd")),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR",     (1, 4), (1, 4), CAT_COLORS["critical"]),
        ("FONTNAME",      (1, 4), (1, 4), FONT_BOLD_NAME),
    ]))
    story.append(t)

    problem = (metrics["critical"] or 0) + (metrics["repair"] or 0)
    total   = metrics["total"] or 1
    pct     = problem / total * 100
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(
        T["summary"].format(total=total, problem=problem, pct=f"{pct:.0f}"),
        s["RuBody"]))

    story.append(Paragraph(T["s2"], s["RuH2"]))
    if critical:
        head = [T["th_num"], T["th_name"], T["th_year"], T["th_age"], T["th_risk"], T["th_insp"]]
        data = [[Paragraph(h, s["RuCellB"]) for h in head]]
        for i, o in enumerate(critical[:30], 1):
            data.append([
                Paragraph(str(i), s["RuCell"]),
                Paragraph(o.get("name") or "--", s["RuCell"]),
                Paragraph(_safe(o.get("year_built"), "{:.0f}"), s["RuCell"]),
                Paragraph(_safe(o.get("age"), "{:.0f}"), s["RuCell"]),
                Paragraph(_safe(o.get("risk_score"), "{:.0%}"), s["RuCellB"]),
                Paragraph(o.get("next_inspection_date") or "--", s["RuCell"]),
            ])
        t2 = Table(data, colWidths=[1*cm, 7*cm, 1.5*cm, 1.8*cm, 1.5*cm, 3*cm], repeatRows=1)
        t2.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#1f2d3a")),
            ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TEXTCOLOR",     (4, 1), (4, -1), CAT_COLORS["critical"]),
        ]))
        story.append(t2)
        if len(critical) > 30:
            story.append(Spacer(1, 0.2*cm))
            story.append(Paragraph(T["more"].format(n=len(critical)-30), s["RuBody"]))
    else:
        story.append(Paragraph(T["no_critical"], s["RuBody"]))

    story.append(PageBreak())
    story.append(Paragraph(T["s3"], s["RuH2"]))
    story.append(Paragraph(T["s3_desc"], s["RuBody"]))
    story.append(Spacer(1, 0.3*cm))

    if upcoming:
        head3 = [T["th_date"], T["th_name"], T["th_state"], T["th_risk"]]
        data3 = [[Paragraph(h, s["RuCellB"]) for h in head3]]
        for o in upcoming:
            data3.append([
                Paragraph(o.get("next_inspection_date") or "--", s["RuCell"]),
                Paragraph(o.get("name") or "--", s["RuCell"]),
                Paragraph(cat_labels.get(o.get("category", ""), "--"), s["RuCell"]),
                Paragraph(_safe(o.get("risk_score"), "{:.0%}"), s["RuCell"]),
            ])
        t3 = Table(data3, colWidths=[3*cm, 7*cm, 3.3*cm, 2*cm], repeatRows=1)
        t3.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#1f2d3a")),
            ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t3)
    else:
        story.append(Paragraph("--", s["RuBody"]))

    story.append(Spacer(1, 0.6*cm))
    story.append(Paragraph(T["footer2"], s["RuSub"]))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    buf.seek(0)
    return buf.read()
