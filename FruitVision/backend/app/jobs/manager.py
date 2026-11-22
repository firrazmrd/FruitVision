"""Job manager lokal (satu pengguna): tiap job = subprocess (python -m <modul>) dengan file status + log yang bertahan saat API restart."""
import json, os, re, subprocess, sys, time, uuid
import psutil
from ..data.dataset_config import ART, BACKEND
JOBS = ART / "jobs"; FINAL = {"completed", "failed", "cancelled", "interrupted"}; _procs = {}
MODULES = {"validate": "app.data.dataset_validator", "manifest": "app.data.data_splitter", "train": "app.cv.experiments", "segeval": "app.cv.seg_eval"}


def _save(j): JOBS.mkdir(parents=True, exist_ok=True); (JOBS / f"{j['id']}.json").write_text(json.dumps(j, indent=2), encoding="utf-8")
def _load(jid):
    p = JOBS / f"{jid}.json"; return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
def _alive(j):
    try: return bool(j.get("pid")) and psutil.pid_exists(j["pid"]) and abs(psutil.Process(j["pid"]).create_time() - j["pid_create_time"]) < 1
    except psutil.Error: return False


def refresh(j):
    if j["status"] in FINAL: return j
    pr = _procs.get(j["id"])
    if pr is not None:
        rc = pr.poll()
        if rc is None: return j
        j.update(status="cancelled" if j.get("cancel_requested") else "completed" if rc == 0 else "failed", exit_code=rc, ended=time.time())
    elif not _alive(j): j.update(status="cancelled" if j.get("cancel_requested") else "interrupted", ended=time.time())
    else: return j
    _save(j); return j


def active(): return any(refresh(j)["status"] == "running" for j in list_jobs(raw=True))
def list_jobs(raw=False):
    if not JOBS.exists(): return []
    js = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(JOBS.glob("*.json"), reverse=True)]
    return js if raw else [describe(refresh(j)) for j in js]


def start(kind, args=()):
    if active(): raise RuntimeError("Ada job lain yang sedang berjalan.")
    jid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]; JOBS.mkdir(parents=True, exist_ok=True); log = JOBS / f"{jid}.log"
    argv = [sys.executable, "-m", MODULES[kind], *map(str, args)]
    pr = subprocess.Popen(argv, cwd=BACKEND, stdout=open(log, "wb"), stderr=subprocess.STDOUT, env=dict(os.environ, PYTHONUNBUFFERED="1", PYTHONIOENCODING="utf-8"))
    try: ct = psutil.Process(pr.pid).create_time()
    except psutil.Error: ct = 0
    j = dict(id=jid, kind=kind, status="running", args=[str(x) for x in args], started=time.time(), ended=None, exit_code=None, pid=pr.pid, pid_create_time=ct, log=str(log))
    _procs[jid] = pr; _save(j); return describe(j)


def cancel(jid):
    j = _load(jid)
    if j is None: return None
    j = refresh(j)
    if j["status"] != "running": return describe(j)
    j["cancel_requested"] = True; _save(j)
    try: p = psutil.Process(j["pid"]); [c.kill() for c in p.children(recursive=True)]; p.kill()
    except psutil.Error: pass
    if j["id"] in _procs:
        try: _procs[j["id"]].wait(timeout=10)
        except Exception: pass
    return describe(refresh(_load(jid)))


def logs(jid, tail=300):
    p = JOBS / f"{jid}.log"
    return "\n".join(p.read_text(encoding="utf-8", errors="replace").splitlines()[-tail:]) if p.exists() else ""


def describe(j):
    j = dict(j); end = j["ended"] or time.time(); j["elapsed_seconds"] = round(end - j["started"], 1); j.pop("pid_create_time", None)
    if j["kind"] == "train":   # progres berbasis tahap (tanpa persentase karangan)
        t = logs(j["id"], 2000); plan = re.search(r"^RENCANA: (\d+) eksperimen", t, re.M); done = re.findall(r"^DONE (\S+) ", t, re.M)
        stage = "training_models" if re.search(r"^Gambar gagal diproses", t, re.M) else "extracting_features" if re.search(r"Menghitung fitur|Parallel", t) else "preparing"
        j["progress"] = dict(stage=stage, experiments_done=done, experiments_total=int(plan.group(1)) if plan else None)
    return j
