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

# Цвета категорий для таблиц
CAT_COLORS = {
    "critical": colors.HexColor("#ef4444"),
    "repair":   colors.HexColor("#f97316"),
    "watch":    colors.HexColor("#eab308"),
    "normal":   colors.HexColor("#22c55e"),
}
CAT_LABELS = {
    "critical": "Аварийное",
    "repair":   "Требует ремонта",
    "watch":    "Наблюдение",
    "normal":   "Исправное",
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
        SELECT COUNT(*) total,
          ROUND(AVG(risk_score),3) avg_risk,
          ROUND(AVG(efficiency_actual),3) avg_kpd,
          ROUND(AVG(age),1) avg_age,
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
        WHERE o.category = 'critical'
        ORDER BY o.risk_score DESC
    """).fetchall()]

    # Ближайшие осмотры (топ-15 по дате)
    upcoming = [dict(r) for r in conn.execute("""
        SELECT o.name, o.category, o.risk_score, o.next_inspection_date,
               d.name AS district_name
        FROM objects o LEFT JOIN districts d ON o.district_id = d.id
        WHERE o.next_inspection_date IS NOT NULL
        ORDER BY o.next_inspection_date ASC
        LIMIT 15
    """).fetchall()]

    conn.close()
    return metrics, critical, upcoming


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("DejaVu", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawString(2 * cm, 1 * cm, "РГП «Казводхоз» · Цифровой каталог ГТС")
    canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, f"Стр. {doc.page}")
    canvas.restoreState()


def generate_report() -> bytes:
    """Генерирует PDF-отчёт о состоянии гидротехнических сооружений региона."""
    metrics, critical, upcoming = _fetch_report_data()
    s = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
    )
    story = []

    # ── Титул ──
    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("Аналитический отчёт", s["RuTitle"]))
    story.append(Paragraph("о техническом состоянии гидротехнических сооружений", s["RuSub"]))
    story.append(Paragraph("Жамбылской области", s["RuSub"]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(f"по состоянию на {date.today().strftime('%d.%m.%Y')}", s["RuSub"]))
    story.append(Spacer(1, 0.8 * cm))

    # ── Сводка ──
    story.append(Paragraph("1. Сводные показатели", s["RuH2"]))
    summary_rows = [
        ["Всего объектов на учёте", str(metrics["total"])],
        ["Средний индекс риска", f"{metrics['avg_risk']*100:.0f}%"],
        ["Средний фактический КПД", f"{metrics['avg_kpd']*100:.0f}%"],
        ["Средний возраст сооружений", f"{metrics['avg_age']:.0f} лет"],
        ["Аварийное состояние", str(metrics["critical"])],
        ["Требуют ремонта", str(metrics["repair"])],
        ["Под наблюдением", str(metrics["watch"])],
        ["Исправное состояние", str(metrics["normal"])],
    ]
    t = Table(summary_rows, colWidths=[10 * cm, 5 * cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "DejaVu"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#dddddd")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (1, 4), (1, 4), CAT_COLORS["critical"]),
        ("FONTNAME", (1, 4), (1, 4), "DejaVu-Bold"),
    ]))
    story.append(t)

    # ── Вывод ──
    problem = metrics["critical"] + metrics["repair"]
    pct = problem / metrics["total"] * 100 if metrics["total"] else 0
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        f"Из {metrics['total']} сооружений {problem} ({pct:.0f}%) требуют "
        f"первоочередного вмешательства — ремонта или аварийного восстановления. "
        f"Ниже приведён перечень объектов в аварийном состоянии и план их осмотра.",
        s["RuBody"]))

    # ── Таблица аварийных ──
    story.append(Paragraph("2. Объекты в аварийном состоянии", s["RuH2"]))
    if critical:
        head = ["№", "Наименование", "Год", "Возраст", "Риск", "Осмотр до"]
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
        t2 = Table(data, colWidths=[1 * cm, 7 * cm, 1.5 * cm, 1.8 * cm, 1.5 * cm, 3 * cm], repeatRows=1)
        t2.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2d3a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TEXTCOLOR", (4, 1), (4, -1), CAT_COLORS["critical"]),
        ]))
        story.append(t2)
        if len(critical) > 30:
            story.append(Spacer(1, 0.2 * cm))
            story.append(Paragraph(f"…и ещё {len(critical) - 30} объектов в полной базе данных.", s["RuBody"]))
    else:
        story.append(Paragraph("Объектов в аварийном состоянии не выявлено.", s["RuBody"]))

    # ── План осмотров ──
    story.append(PageBreak())
    story.append(Paragraph("3. План ближайших осмотров", s["RuH2"]))
    story.append(Paragraph(
        "Перечень объектов с наиболее близкими сроками технического осмотра, "
        "рассчитанными на основе индекса риска и значимости сооружения.", s["RuBody"]))
    story.append(Spacer(1, 0.3 * cm))

    head3 = ["Дата осмотра", "Наименование", "Состояние", "Риск"]
    data3 = [[Paragraph(h, s["RuCellB"]) for h in head3]]
    for o in upcoming:
        data3.append([
            Paragraph(o["next_inspection_date"] or "—", s["RuCell"]),
            Paragraph(o["name"] or "—", s["RuCell"]),
            Paragraph(CAT_LABELS.get(o["category"], "—"), s["RuCell"]),
            Paragraph(f"{o['risk_score']*100:.0f}%", s["RuCell"]),
        ])
    t3 = Table(data3, colWidths=[3 * cm, 7 * cm, 3.3 * cm, 2 * cm], repeatRows=1)
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2d3a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t3)

    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        "Отчёт сформирован автоматически системой цифрового каталога "
        "гидротехнических сооружений. Геопривязка объектов и интерактивная "
        "карта доступны в веб-интерфейсе системы.", s["RuSub"]))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    buf.seek(0)
    return buf.read()
