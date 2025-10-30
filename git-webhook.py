#!/usr/bin/env python3
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import hmac
import hashlib
import subprocess
import os
import logging
from typing import Dict, Any

# ===================== CONFIGURAÇÃO =====================
SECRET = "777-Rroot"  # MESMA DO GITHUB!
BRANCH = "refs/heads/main"
DEPLOY_SCRIPT = "/home/ubuntu/WpWebSolucoes/deploy.sh"
WORK_DIR = "/home/ubuntu/WpWebSolucoes"

# Logging
logging.basicConfig(
    filename="/home/ubuntu/webhook.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

app = FastAPI(title="GitHub Webhook → Autodeploy")

class GitHubPayload(BaseModel):
    ref: str
    before: str
    after: str
    pusher: Dict[str, Any]
    repository: Dict[str, Any]

def verify_signature(request: Request, body: bytes) -> bool:
    signature = request.headers.get("X-Hub-Signature-256")
    if not signature:
        return False
    sha_name, signature = signature.split("=")
    if sha_name != "sha256":
        return False
    mac = hmac.new(SECRET.encode(), msg=body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)

def run_deploy(pusher_name: str):
    try:
        logging.info(f"Deploy iniciado por {pusher_name}")
        result = subprocess.run(
            [DEPLOY_SCRIPT, pusher_name, BRANCH],
            cwd=WORK_DIR,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            logging.info(f"Deploy OK: {result.stdout}")
        else:
            logging.error(f"Deploy FALHOU: {result.stderr}")
        return result
    except Exception as e:
        logging.error(f"Erro ao executar deploy: {e}")
        raise

@app.post("/webhook")
async def github_webhook(request: Request):
    # 1. Verificar evento
    event = request.headers.get("X-GitHub-Event")
    if event != "push":
        logging.info(f"Ignorando evento: {event}")
        return HTTPException(status_code=400, detail="Invalid event")
    # 2. Ler body
    body = await request.body()

    # 3. Verificar assinatura
    if not verify_signature(request, body):
        logging.warning("Assinatura inválida!")
        raise HTTPException(status_code=403, detail="Invalid signature")

    # 4. Parse do payload
    try:
        payload = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    ref = payload.get("ref")
    pusher = payload.get("pusher", {}).get("name", "unknown")

    # 5. Só deploy no branch main
    if ref != BRANCH:
        logging.info(f"Ignorando branch: {ref}")
        return {"status": "ignored", "branch": ref}

    # 6. EXECUTAR DEPLOY
    logging.info(f"Deploy TRIGGERED por {pusher} em {ref}")
    run_deploy(pusher)

    return {
        "status": "deploy_triggered",
        "pusher": pusher,
        "branch": ref,
        "message": "Deploy em andamento..."
    }

@app.get("/")
def root():
    return {"status": "webhook ativo", "endpoint": "/webhook"}