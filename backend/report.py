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

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

CAT_COLORS = {
    "critical": colors.HexColor("#ef4444"),
    "repair":   colors.HexColor("#f97316"),
    "watch":    colors.HexColor("#eab308"),
    "normal":   colors.HexColor("#22c55e"),
}

# Переводы для PDF на трёх языках
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
        "summary": "Из {total} сооружений {problem} ({pct}%) требуют первоочередного вмешательства — ремонта или аварийного восстановления. Ниже приведён перечень объектов в аварийном состоянии и план их осмотра.",
        "s2": "2. Объекты в аварийном состоянии",
        "no_critical": "Объектов в аварийном состоянии не выявлено.",
        "th_num": "№", "th_name": "Наименование", "th_year": "Год",
        "th_age": "Возраст", "th_risk": "Риск", "th_insp": "Осмотр до",
        "more": "…и ещё {n} объектов в полной базе данных.",
        "s3": "3. План ближайших осмотров",
        "s3_desc": "Перечень объектов с наиболее близкими сроками технического осмотра, рассчитанными на основе индекса риска и значимости сооружения.",
        "th_date": "Дата осмотра", "th_state": "Состояние",
        "footer2": "Отчёт сформирован автоматически системой цифрового каталога гидротехнических сооружений. Геопривязка объектов и интерактивная карта доступны в веб-интерфейсе системы.",
        "cat_critical": "Аварийное", "cat_repair": "Требует ремонта",
        "cat_watch": "Наблюдение", "cat_normal": "Исправное",
    },
    "kz": {
        "title": "Аналитикалық есеп",
        "subtitle1": "гидротехникалық құрылыстардың техникалық жай-күйі туралы",
        "subtitle2": "Жамбыл облысы",
        "asof": "жағдай бойынша",
        "footer": "«Қазсушаруа» РМК · ГТҚ цифрлық каталогы",
        "page": "Бет",
        "s1": "1. Жиынтық көрсеткіштер",
        "m_total": "Есепте тұрған барлық нысандар",
        "m_risk": "Орташа қауіп индексі",
        "m_kpd": "Орташа нақты ПӘК",
        "m_age": "Құрылыстардың орташа жасы",
        "m_critical": "Апаттық жағдай",
        "m_repair": "Жөндеуді қажет етеді",
        "m_watch": "Бақылауда",
        "m_normal": "Жарамды жағдай",
        "summary": "{total} құрылыстың {problem} ({pct}%) бірінші кезектегі араласуды — жөндеуді немесе апаттық қалпына келтіруді қажет етеді. Төменде апаттық жағдайдағы нысандар тізімі және оларды тексеру жоспары келтірілген.",
        "s2": "2. Апаттық жағдайдағы нысандар",
        "no_critical": "Апаттық жағдайдағы нысандар анықталмады.",
        "th_num": "№", "th_name": "Атауы", "th_year": "Жыл",
        "th_age": "Жасы", "th_risk": "Қауіп", "th_insp": "Тексеру",
        "more": "…және тағы {n} нысан толық деректер базасында.",
        "s3": "3. Жақын тексерулер жоспары",
        "s3_desc": "Қауіп индексі мен құрылыстың маңыздылығы негізінде есептелген техникалық тексерудің ең жақын мерзімдері бар нысандар тізімі.",
        "th_date": "Тексеру күні", "th_state": "Жай-күйі",
        "footer2": "Есеп гидротехникалық құрылыстардың цифрлық каталог жүйесімен автоматты түрде жасалды. Нысандардың геобайланысы және интерактивті карта жүйенің веб-интерфейсінде қолжетімді.",
        "cat_critical": "Апаттық", "cat_repair": "Жөндеуді қажет етеді",
        "cat_watch": "Бақылау", "cat_normal": "Жарамды",
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
        "summary": "Of {total} structures, {problem} ({pct}%) require priority intervention — repair or emergency restoration. Below is a list of objects in critical condition and their inspection plan.",
        "s2": "2. Objects in critical condition",
        "no_critical": "No objects in critical condition found.",
        "th_num": "No.", "th_name": "Name", "th_year": "Year",
        "th_age": "Age", "th_risk": "Risk", "th_insp": "Inspect by",
        "more": "…and {n} more objects in the full database.",
        "s3": "3. Upcoming inspections plan",
        "s3_desc": "List of objects with the nearest technical inspection dates, calculated based on the risk index and structure importance.",
        "th_date": "Inspection date", "th_state": "Condition",
        "footer2": "The report is generated automatically by the digital catalog system of hydraulic structures. Object geolocation and interactive map are available in the system web interface.",
        "cat_critical": "Critical", "cat_repair": "Needs repair",
        "cat_watch": "Monitoring", "cat_normal": "Operational",
    },
}


def _register_fonts():
    if "DejaVu" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("DejaVu", FONT_PATH))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_BOLD))


def _styles():
    _register_fonts()
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("RuTitle", fontName="DejaVu-Bold", fontSize=20,
                         leading=26, alignment=TA_CENTER, spaceAfter=6))
    s.add(ParagraphStyle("RuSub", fontName="DejaVu", fontSize=11,
                         leading=15, alignment=TA_CENTER, textColor=colors.grey, spaceAfter=4))
    s.add(ParagraphStyle("RuH2", fontName="DejaVu-Bold", fontSize=14,
                         leading=18, spaceBefore=16, spaceAfter=8))
    s.add(ParagraphStyle("RuBody", fontName="DejaVu", fontSize=10,
                         leading=14, alignment=TA_LEFT))
    s.add(ParagraphStyle("RuCell", fontName="DejaVu", fontSize=8, leading=10))
    s.add(ParagraphStyle("RuCellB", fontName="DejaVu-Bold", fontSize=8, leading=10))
    return s


def _fetch_report_data():
    conn = get_db()
    metrics = dict(conn.execute("""
        SELECT COUNT(*) total, ROUND(AVG(risk_score),3) avg_risk,
          ROUND(AVG(efficiency_actual),3) avg_kpd, ROUND(AVG(age),1) avg_age,
          SUM(CASE WHEN category='critical' THEN 1 ELSE 0 END) critical,
          SUM(CASE WHEN category='repair' THEN 1 ELSE 0 END) repair,
          SUM(CASE WHEN category='watch' THEN 1 ELSE 0 END) watch,
          SUM(CASE WHEN category='normal' THEN 1 ELSE 0 END) normal
        FROM objects
    """).fetchone())

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


def generate_report(lang: str = "ru") -> bytes:
    """Генерирует PDF-отчёт на выбранном языке (ru / kz / en)."""
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
        canvas.setFont("DejaVu", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(2*cm, 1*cm, T["footer"])
        canvas.drawRightString(A4[0]-2*cm, 1*cm, f"{T['page']} {doc.page}")
        canvas.restoreState()

    # Титул
    story.append(Spacer(1, 1*cm))
    story.append(Paragraph(T["title"], s["RuTitle"]))
    story.append(Paragraph(T["subtitle1"], s["RuSub"]))
    story.append(Paragraph(T["subtitle2"], s["RuSub"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(f"{T['asof']} {date.today().strftime('%d.%m.%Y')}", s["RuSub"]))
    story.append(Spacer(1, 0.8*cm))

    # Сводка
    story.append(Paragraph(T["s1"], s["RuH2"]))
    summary_rows = [
        [T["m_total"], str(metrics["total"])],
        [T["m_risk"], f"{metrics['avg_risk']*100:.0f}%"],
        [T["m_kpd"], f"{metrics['avg_kpd']*100:.0f}%"],
        [T["m_age"], f"{metrics['avg_age']:.0f}"],
        [T["m_critical"], str(metrics["critical"])],
        [T["m_repair"], str(metrics["repair"])],
        [T["m_watch"], str(metrics["watch"])],
        [T["m_normal"], str(metrics["normal"])],
    ]
    t = Table(summary_rows, colWidths=[10*cm, 5*cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "DejaVu"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("LINEBELOW", (0,0), (-1,-1), 0.3, colors.HexColor("#dddddd")),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TEXTCOLOR", (1,4), (1,4), CAT_COLORS["critical"]),
        ("FONTNAME", (1,4), (1,4), "DejaVu-Bold"),
    ]))
    story.append(t)

    problem = metrics["critical"] + metrics["repair"]
    pct = problem / metrics["total"] * 100 if metrics["total"] else 0
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(
        T["summary"].format(total=metrics["total"], problem=problem, pct=f"{pct:.0f}"),
        s["RuBody"]))

    # Аварийные
    story.append(Paragraph(T["s2"], s["RuH2"]))
    if critical:
        head = [T["th_num"], T["th_name"], T["th_year"], T["th_age"], T["th_risk"], T["th_insp"]]
        data = [[Paragraph(h, s["RuCellB"]) for h in head]]
        for i, o in enumerate(critical[:30], 1):
            yb = int(o["year_built"]) if o["year_built"] else "—"
            data.append([
                Paragraph(str(i), s["RuCell"]),
                Paragraph(o["name"] or "—", s["RuCell"]),
                Paragraph(str(yb), s["RuCell"]),
                Paragraph(f"{o['age']:.0f}" if o["age"] else "—", s["RuCell"]),
                Paragraph(f"{o['risk_score']*100:.0f}%", s["RuCellB"]),
                Paragraph(o["next_inspection_date"] or "—", s["RuCell"]),
            ])
        t2 = Table(data, colWidths=[1*cm, 7*cm, 1.5*cm, 1.8*cm, 1.5*cm, 3*cm], repeatRows=1)
        t2.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1f2d3a")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f7f7f7")]),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("TEXTCOLOR", (4,1), (4,-1), CAT_COLORS["critical"]),
        ]))
        story.append(t2)
        if len(critical) > 30:
            story.append(Spacer(1, 0.2*cm))
            story.append(Paragraph(T["more"].format(n=len(critical)-30), s["RuBody"]))
    else:
        story.append(Paragraph(T["no_critical"], s["RuBody"]))

    # План осмотров
    story.append(PageBreak())
    story.append(Paragraph(T["s3"], s["RuH2"]))
    story.append(Paragraph(T["s3_desc"], s["RuBody"]))
    story.append(Spacer(1, 0.3*cm))

    head3 = [T["th_date"], T["th_name"], T["th_state"], T["th_risk"]]
    data3 = [[Paragraph(h, s["RuCellB"]) for h in head3]]
    for o in upcoming:
        data3.append([
            Paragraph(o["next_inspection_date"] or "—", s["RuCell"]),
            Paragraph(o["name"] or "—", s["RuCell"]),
            Paragraph(cat_labels.get(o["category"], "—"), s["RuCell"]),
            Paragraph(f"{o['risk_score']*100:.0f}%", s["RuCell"]),
        ])
    t3 = Table(data3, colWidths=[3*cm, 7*cm, 3.3*cm, 2*cm], repeatRows=1)
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1f2d3a")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("GRID", (0,0), (-1,-1), 0.3, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f7f7f7")]),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(t3)

    story.append(Spacer(1, 0.6*cm))
    story.append(Paragraph(T["footer2"], s["RuSub"]))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    buf.seek(0)
    return buf.read()
