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
async def get_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login")
async def get_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register")
async def get_register(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/dashboard")
async def get_dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})

# Adicione outras rotas conforme necessário para suas páginas
@app.get("/services")
async def get_services(request: Request):
    return templates.TemplateResponse("services.html", {"request": request})

@app.get("/contact")
async def get_contact(request: Request):
    return templates.TemplateResponse("contact.html", {"request": request})

# Rota de health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "WP Web Soluções API is running"}

# Se você quiser uma rota para servir o base.html diretamente (opcional)
@app.get("/base")
async def get_base(request: Request):
    return templates.TemplateResponse("base.html", {"request": request})

@app.get("/about")
async def get_about(request: Request):
    return {"status": "about"}