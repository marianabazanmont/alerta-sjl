"""
Genera toda la evidencia de planificación a partir de backlog.json:
  - jira_import.csv        -> importar épicas e historias a Jira (con Parent Id, story points y prioridad)
  - backlog.md             -> tablas de épicas, historias y sprints para pegar en el informe
  - burndown_release.png   -> quemado de story points y de historias por sprint (ideal vs real)
  - velocidad.png          -> comprometido vs completado por sprint y velocidad promedio
  - burndown_sprints.png   -> burndown diario de cada sprint (ideal vs real)
  - gantt.png              -> cronograma por épicas e historias, dependencias e hitos
  - kanban.png             -> foto del tablero a mitad de cada sprint con límites WIP

Uso:  python generar.py            (requiere: pip install matplotlib)
Para otro caso: edita SOLO backlog.json y vuelve a ejecutar.
"""
import csv
import json
import math
from datetime import date, timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyBboxPatch  # noqa: E402

AQUI = Path(__file__).parent
DATA = json.loads((AQUI / "backlog.json").read_text(encoding="utf-8"))

# Paleta validada (categórica en orden fijo) + neutros
COL_EPICA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6", "#008300", "#e34948"]
REAL, IDEAL, GRIS, TEXTO, TEXTO2, SUP = "#2a78d6", "#8a8984", "#c9c8c2", "#0b0b0b", "#52514e", "#fcfcfb"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": GRIS, "axes.labelcolor": TEXTO2,
    "xtick.color": TEXTO2, "ytick.color": TEXTO2, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": "#ecebe7", "grid.linewidth": 0.8, "figure.facecolor": SUP, "axes.facecolor": SUP,
    "axes.titleweight": "bold", "axes.titlesize": 12, "axes.titlecolor": TEXTO,
})

DIAS = DATA["duracion_sprint_dias_habiles"]
SPRINTS = DATA["sprints"]
EPICAS = DATA["epicas"]
COLOR = {e["id"]: COL_EPICA[i % len(COL_EPICA)] for i, e in enumerate(EPICAS)}
HU = DATA["historias"]
PLAN = [h for h in HU if h["sprint_inicio"]]  # las Won't no entran a sprints
NOMBRE_EPICA = {e["id"]: e["nombre"] for e in EPICAS}


def d(s):
    return date.fromisoformat(s)


def dia_habil(inicio, n):
    """Fecha del n-ésimo día hábil (1 = primer día) desde el inicio del sprint."""
    f, cuenta = d(inicio), 1
    while f.weekday() >= 5:
        f += timedelta(days=1)
    while cuenta < n:
        f += timedelta(days=1)
        if f.weekday() < 5:
            cuenta += 1
    return f


def sprint(sid):
    return next(s for s in SPRINTS if s["id"] == sid)


def titulo(h):
    return f"Como {h['rol']}, quiero {h['accion']}, para {h['beneficio']}"


# ---------- Programación simulada de cada historia (día de inicio y día de término) ----------
for s in SPRINTS:
    terminan = [h for h in PLAN if h["sprint_fin"] == s["id"]]
    arrastradas = [h for h in terminan if h["sprint_inicio"] < s["id"]]
    nuevas = [h for h in terminan if h["sprint_inicio"] == s["id"]]
    orden = arrastradas + nuevas
    n = len(orden)
    for k, h in enumerate(orden):
        fin = max(2, math.ceil(DIAS * (k + 1) / n))
        if h in arrastradas:
            fin = min(fin, 3 + k)
        h["dia_fin"] = fin
        h["fecha_fin"] = dia_habil(s["inicio"], fin)
for h in PLAN:
    si = sprint(h["sprint_inicio"])
    dur = max(2, min(8, round(h["puntos"] * 0.9)))
    if h["sprint_inicio"] == h["sprint_fin"]:
        h["dia_ini"] = max(1, h["dia_fin"] - dur + 1)
    else:  # empezó en un sprint y no se terminó: se arrastra al siguiente
        h["dia_ini"] = max(1, DIAS - dur + 2)
    h["fecha_ini"] = dia_habil(si["inicio"], h["dia_ini"])


def comprometidas(sid):
    return [h for h in PLAN if h["sprint_inicio"] <= sid <= h["sprint_fin"]]


def completadas(sid):
    return [h for h in PLAN if h["sprint_fin"] == sid]


# ---------- 1. CSV para Jira ----------
def exportar_jira():
    prioridad = {"Must": "Highest", "Should": "High", "Could": "Medium", "Won't": "Low"}
    filas = []
    for i, e in enumerate(EPICAS, start=1):
        filas.append({
            "Issue Id": i, "Parent Id": "", "Issue Type": "Epic", "Summary": f"{e['id']} - {e['nombre']}",
            "Epic Name": e["nombre"],
            "Description": f"Descripción: {e['descripcion']}\n\nObjetivo de negocio: {e['objetivo']}",
            "Priority": "Highest", "Story Points": "", "Labels": "epica", "Labels ": "", "Sprint": "",
        })
    id_epica = {e["id"]: i for i, e in enumerate(EPICAS, start=1)}
    for j, h in enumerate(HU, start=100):
        criterios = "\n".join(f"* {c}" for c in h["criterios"])
        dep = f"\n\nDepende de: {', '.join(h['depende'])}" if h.get("depende") else ""
        filas.append({
            "Issue Id": j, "Parent Id": id_epica[h["epica"]], "Issue Type": "Story",
            "Summary": f"{h['id']} - {h['accion'][0].upper()}{h['accion'][1:]}",
            "Epic Name": "",
            "Description": f"{titulo(h)}.\n\nCriterios de aceptación:\n{criterios}\n\nMoSCoW: {h['moscow']}{dep}",
            "Priority": prioridad[h["moscow"]], "Story Points": h["puntos"],
            "Labels": h["moscow"].replace("'", ""), "Labels ": NOMBRE_EPICA[h["epica"]].split()[0].lower(),
            "Sprint": sprint(h["sprint_inicio"])["nombre"] if h["sprint_inicio"] else "",
        })
    with open(AQUI / "jira_import.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)


# ---------- 2. Tablas en Markdown ----------
def exportar_md():
    L = [f"# Backlog de {DATA['proyecto']}\n", "## Épicas\n", "| ID | Épica | Descripción | Objetivo de negocio |", "|---|---|---|---|"]
    L += [f"| {e['id']} | {e['nombre']} | {e['descripcion']} | {e['objetivo']} |" for e in EPICAS]
    L += ["\n## Historias de usuario\n", "| ID | Épica | Historia | SP | MoSCoW | Sprint |", "|---|---|---|---|---|---|"]
    for h in HU:
        sp = "—" if not h["sprint_inicio"] else (f"S{h['sprint_inicio']}" + (f"→S{h['sprint_fin']}" if h["sprint_fin"] != h["sprint_inicio"] else ""))
        L.append(f"| {h['id']} | {h['epica']} | {titulo(h)} | {h['puntos']} | {h['moscow']} | {sp} |")
    L += ["\n## Criterios de aceptación\n"]
    for h in HU:
        L.append(f"**{h['id']}**")
        L += [f"- {c}" for c in h["criterios"]]
        L.append("")
    L += ["## Sprints\n", "| Sprint | Fechas | Sprint goal | Sprint backlog | SP comprometidos | SP completados |", "|---|---|---|---|---|---|"]
    for s in SPRINTS:
        c, k = comprometidas(s["id"]), completadas(s["id"])
        L.append(f"| {s['nombre']} | {d(s['inicio']):%d/%m} – {d(s['fin']):%d/%m/%Y} | {s['goal']} | "
                 f"{', '.join(h['id'] for h in c)} | {sum(h['puntos'] for h in c)} | {sum(h['puntos'] for h in k)} |")
    vel = [sum(h["puntos"] for h in completadas(s["id"])) for s in SPRINTS]
    L.append(f"\nVelocidad por sprint: {vel} · Velocidad promedio: {sum(vel) / len(vel):.2f} SP/sprint")
    (AQUI / "backlog.md").write_text("\n".join(L), encoding="utf-8")
    return vel


# ---------- 3. Burndown del release (puntos e historias por sprint) ----------
def burndown_release():
    total_sp, total_hu = sum(h["puntos"] for h in PLAN), len(PLAN)
    n = len(SPRINTS)
    etiquetas = ["Inicio"] + [s["nombre"] for s in SPRINTS]
    real_sp, real_hu = [total_sp], [total_hu]
    for s in SPRINTS:
        real_sp.append(real_sp[-1] - sum(h["puntos"] for h in completadas(s["id"])))
        real_hu.append(real_hu[-1] - len(completadas(s["id"])))
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.6))
    for ax, real, total, nombre in [(axes[0], real_sp, total_sp, "Story points restantes"), (axes[1], real_hu, total_hu, "Historias de usuario restantes")]:
        ideal = [total - total * i / n for i in range(n + 1)]
        ax.plot(etiquetas, ideal, color=IDEAL, lw=2, ls="--", label="Ideal")
        ax.plot(etiquetas, real, color=REAL, lw=2, marker="o", ms=8, markeredgecolor=SUP, markeredgewidth=2, label="Real")
        for x, y in zip(etiquetas, real):
            ax.annotate(f"{y:g}", (x, y), textcoords="offset points", xytext=(0, 10), ha="center", color=TEXTO, fontsize=9)
        ax.set_title(nombre)
        ax.set_ylim(0, total * 1.15)
        ax.legend(frameon=False)
    fig.suptitle(f"Burndown del release – {DATA['proyecto']} (4 sprints)", fontweight="bold", color=TEXTO)
    fig.tight_layout()
    fig.savefig(AQUI / "burndown_release.png", dpi=150)
    plt.close(fig)


# ---------- 4. Velocidad ----------
def velocidad(vel):
    comp = [sum(h["puntos"] for h in comprometidas(s["id"])) for s in SPRINTS]
    x = range(len(SPRINTS))
    fig, ax = plt.subplots(figsize=(8, 4.6))
    ax.bar([i - 0.2 for i in x], comp, width=0.38, color=GRIS, label="Comprometido")
    ax.bar([i + 0.2 for i in x], vel, width=0.38, color=REAL, label="Completado (velocidad)")
    for i in x:
        ax.text(i - 0.2, comp[i] + 0.4, comp[i], ha="center", color=TEXTO2, fontsize=9)
        ax.text(i + 0.2, vel[i] + 0.4, vel[i], ha="center", color=TEXTO, fontsize=9, fontweight="bold")
    prom = sum(vel) / len(vel)
    ax.axhline(prom, color=IDEAL, ls="--", lw=1.5)
    ax.text(len(SPRINTS) - 0.5, prom + 0.5, f"Promedio {prom:.1f} SP", ha="right", color=TEXTO2)
    ax.set_xticks(list(x), [s["nombre"] for s in SPRINTS])
    ax.set_ylabel("Story points")
    ax.set_ylim(0, max(comp) * 1.25)
    ax.grid(axis="x", visible=False)
    ax.set_title("Velocidad del equipo por sprint")
    ax.legend(frameon=False, loc="upper left")
    fig.tight_layout()
    fig.savefig(AQUI / "velocidad.png", dpi=150)
    plt.close(fig)


# ---------- 5. Burndown diario por sprint ----------
def burndown_sprints():
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    for ax, s in zip(axes.flat, SPRINTS):
        c = comprometidas(s["id"])
        total = sum(h["puntos"] for h in c)
        dias = list(range(0, DIAS + 1))
        real = [total - sum(h["puntos"] for h in c if h["sprint_fin"] == s["id"] and h["dia_fin"] <= t) for t in dias]
        ax.plot(dias, [total - total * t / DIAS for t in dias], color=IDEAL, ls="--", lw=2, label="Ideal")
        ax.step(dias, real, where="post", color=REAL, lw=2, label="Real")
        ax.plot(dias[-1], real[-1], "o", color=REAL, ms=8, markeredgecolor=SUP, markeredgewidth=2)
        ax.annotate(f"Quedan {real[-1]} SP" if real[-1] else "Sprint completado",
                    (dias[-1], real[-1]), textcoords="offset points", xytext=(-6, 10), ha="right", color=TEXTO, fontsize=9)
        ax.set_title(f"{s['nombre']} ({d(s['inicio']):%d/%m} – {d(s['fin']):%d/%m}) · {total} SP")
        ax.set_xlabel("Día hábil del sprint")
        ax.set_ylabel("SP restantes")
        ax.set_xticks(dias)
        ax.set_ylim(0, total * 1.15)
        ax.legend(frameon=False)
    fig.suptitle("Burndown diario por sprint", fontweight="bold", color=TEXTO)
    fig.tight_layout()
    fig.savefig(AQUI / "burndown_sprints.png", dpi=150)
    plt.close(fig)


# ---------- 6. Gantt ----------
def gantt():
    import matplotlib.dates as mdates

    filas = []
    for e in EPICAS:
        hs = [h for h in PLAN if h["epica"] == e["id"]]
        if not hs:
            continue
        filas.append(("epica", e, min(h["fecha_ini"] for h in hs), max(h["fecha_fin"] for h in hs)))
        for h in sorted(hs, key=lambda x: x["fecha_ini"]):
            filas.append(("hu", h, h["fecha_ini"], h["fecha_fin"]))
    alto = 0.42 * len(filas) + 2
    fig, ax = plt.subplots(figsize=(14, alto))
    pos = {}
    for i, (tipo, obj, ini, fin) in enumerate(filas):
        y = len(filas) - i
        fin1 = fin + timedelta(days=1)
        if tipo == "epica":
            ax.barh(y, (fin1 - ini).days, left=ini, height=0.36, color=COLOR[obj["id"]], alpha=0.35)
            ax.text(ini - timedelta(days=1), y, f"{obj['id']} {obj['nombre']}", ha="right", va="center", fontweight="bold", color=TEXTO)
        else:
            pos[obj["id"]] = (y, ini, fin1)
            ax.barh(y, (fin1 - ini).days, left=ini, height=0.6, color=COLOR[obj["epica"]], edgecolor=SUP, linewidth=2)
            dep = f"  ← {', '.join(obj['depende'])}" if obj.get("depende") else ""
            ax.text(fin1 + timedelta(hours=8), y, dep, ha="left", va="center", color=TEXTO2, fontsize=8)
            ax.text(ini - timedelta(days=1), y, f"{obj['id']} ({obj['puntos']} SP)", ha="right", va="center", color=TEXTO2, fontsize=9)
    # Dependencias fin-inicio: se dibuja la predecesora que condiciona el inicio (la que termina
    # más tarde) cuando está cerca; todas las dependencias quedan escritas en la etiqueta.
    for h in PLAN:
        preds = [p for p in h.get("depende", []) if p in pos]
        if not preds or h["id"] not in pos:
            continue
        p = max(preds, key=lambda x: pos[x][2])
        y0, _, f0 = pos[p]
        y1, i1, _ = pos[h["id"]]
        if (i1 - f0).days <= 10:
            ax.annotate("", xy=(i1, y1), xytext=(f0, y0),
                        arrowprops=dict(arrowstyle="->", color=IDEAL, lw=1, connectionstyle="angle,angleA=0,angleB=90,rad=4"))
    # Sprints como bandas y hitos como rombos
    for k, s in enumerate(SPRINTS):
        ax.axvspan(d(s["inicio"]), d(s["fin"]) + timedelta(days=1), color="#f1f0ec" if k % 2 == 0 else SUP, zorder=0)
        ax.text(d(s["inicio"]) + timedelta(days=1), len(filas) + 1.1, s["nombre"], color=TEXTO2, fontsize=9, fontweight="bold")
    for m in DATA["hitos"]:
        f = d(m["fecha"]) + timedelta(days=1 if m["nombre"] != "Kick-off" else 0)
        ax.plot(f, len(filas) + 0.5, marker="D", color=TEXTO, ms=9, zorder=5)
        ax.axvline(f, color=TEXTO, lw=0.8, ls=":", zorder=1)
        ax.text(f, len(filas) + 1.6, m["nombre"], ha="center", fontsize=9, color=TEXTO, fontweight="bold")
    ax.set_ylim(0.3, len(filas) + 2.2)
    ax.set_yticks([])
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.set_xlim(d(SPRINTS[0]["inicio"]) - timedelta(days=2), d(SPRINTS[-1]["fin"]) + timedelta(days=3))
    ax.grid(axis="y", visible=False)
    ax.spines["left"].set_visible(False)
    ax.set_title(f"Diagrama de Gantt – {DATA['proyecto']} (épicas, historias, dependencias e hitos)", pad=30)
    fig.tight_layout()
    fig.savefig(AQUI / "gantt.png", dpi=150, bbox_inches="tight")
    plt.close(fig)


# ---------- 7. Kanban (foto a mitad de sprint) ----------
def estado_en(h, sid, dia):
    if h["sprint_fin"] == sid and h["dia_fin"] <= dia:
        return "Done"
    empezo = h["sprint_inicio"] < sid or h["dia_ini"] <= dia
    if not empezo:
        return "To Do"
    if h["sprint_fin"] == sid and h["dia_fin"] - dia <= 1:
        return "In Review"
    return "In Progress"


def kanban():
    cols = ["To Do", "In Progress", "In Review", "Done"]
    wip = DATA["wip"]
    fig, axes = plt.subplots(len(SPRINTS), 1, figsize=(13, 3.3 * len(SPRINTS)))
    avisos = []
    for ax, s in zip(axes, SPRINTS):
        # Se elige el día de mitad de sprint (4 a 7) en el que se ven más columnas con trabajo
        def ocupadas(t):
            return len({estado_en(h, s["id"], t) for h in comprometidas(s["id"])})
        dia = max(range(4, 8), key=lambda t: (ocupadas(t), -abs(t - DIAS / 2)))
        tablero = {c: [] for c in cols}
        for h in comprometidas(s["id"]):
            tablero[estado_en(h, s["id"], dia)].append(h)
        # Respeta los límites WIP: lo que excede vuelve a To Do (no se puede jalar más trabajo)
        for c in ("In Review", "In Progress"):
            while c in wip and len(tablero[c]) > wip[c]:
                tablero["To Do"].append(tablero[c].pop())
        ax.set_xlim(0, 4)
        ax.set_ylim(0, 1)
        ax.axis("off")
        for i, c in enumerate(cols):
            ax.add_patch(FancyBboxPatch((i + 0.03, 0.02), 0.94, 0.8, boxstyle="round,pad=0,rounding_size=0.03", fc="#f1f0ec", ec="none"))
            lim = f" (WIP {len(tablero[c])}/{wip[c]})" if c in wip else f" ({len(tablero[c])})"
            ax.text(i + 0.08, 0.76, c + lim, fontweight="bold", va="top", color=TEXTO, fontsize=10)
            for k, h in enumerate(tablero[c]):
                fila, col = divmod(k, 2)
                x0, y0 = i + 0.08 + col * 0.45, 0.6 - fila * 0.19
                ax.add_patch(FancyBboxPatch((x0, y0 - 0.14), 0.41, 0.15, boxstyle="round,pad=0,rounding_size=0.02", fc="white", ec=GRIS, lw=0.8))
                ax.add_patch(FancyBboxPatch((x0, y0 - 0.14), 0.025, 0.15, boxstyle="square,pad=0", fc=COLOR[h["epica"]], ec="none"))
                ax.text(x0 + 0.045, y0 - 0.04, f"{h['id']} · {h['puntos']} SP", fontsize=8.5, fontweight="bold", color=TEXTO, va="center")
                ax.text(x0 + 0.045, y0 - 0.10, (NOMBRE_EPICA[h["epica"]][:21] + "…") if len(NOMBRE_EPICA[h["epica"]]) > 22 else NOMBRE_EPICA[h["epica"]], fontsize=7, color=TEXTO2, va="center")
        ax.text(0.03, 0.93, f"{s['nombre']} · día {dia} de {DIAS} ({dia_habil(s['inicio'], dia):%d/%m/%Y})",
                fontsize=11, fontweight="bold", color=TEXTO, va="top")
        avisos.append((s["nombre"], {c: len(v) for c, v in tablero.items()}))
    fig.suptitle("Tablero Kanban a mitad de cada sprint (límites WIP: In Progress 3, In Review 2)", fontweight="bold", color=TEXTO)
    fig.tight_layout()
    fig.savefig(AQUI / "kanban.png", dpi=150)
    plt.close(fig)
    return avisos


if __name__ == "__main__":
    exportar_jira()
    vel = exportar_md()
    burndown_release()
    velocidad(vel)
    burndown_sprints()
    gantt()
    print("Kanban:", kanban())
    print("Velocidad:", vel)
    for h in PLAN:
        print(h["id"], f"S{h['sprint_inicio']}-S{h['sprint_fin']}", h["fecha_ini"], h["fecha_fin"])
