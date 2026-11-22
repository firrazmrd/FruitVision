from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from .api.handlers import ApiError, VERSION
from .api.routes import router

app = FastAPI(title="FruitVision API", version=VERSION, description="API lokal satu pengguna. Bind ke 127.0.0.1 saja.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api")


@app.exception_handler(ApiError)
async def api_error(_: Request, e: ApiError):
    return JSONResponse(status_code=e.status, content={"detail": e.detail})


@app.get("/", include_in_schema=False)
def root():
    return HTMLResponse("<meta charset='utf-8'><body style='font-family:sans-serif;max-width:40rem;margin:3rem auto'><h1>FruitVision API aktif</h1>"
                        "<p>Ini server <b>API</b>, bukan antarmuka. Buka antarmuka di <a href='http://127.0.0.1:5173'>http://127.0.0.1:5173</a> "
                        "(jalankan <code>npm run dev</code> di folder <code>frontend</code> pada jendela PowerShell terpisah).</p>"
                        "<p>Dokumentasi API: <a href='/docs'>/docs</a> &middot; Status: <a href='/api/health'>/api/health</a></p></body>")
