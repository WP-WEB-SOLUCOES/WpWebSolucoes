from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request

app = FastAPI()

templates = Jinja2Templates(directory="templates")

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def get_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/{page_name}")
def get_page(request: Request, page_name: str = None):
    try:
        return templates.TemplateResponse(page_name + ".html", {"request": request})
    except Exception:
        return templates.TemplateResponse("404.html", {"request": request})