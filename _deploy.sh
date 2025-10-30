#!/bin/bash
set -e  # Para se qualquer comando falhar

WORK_DIR="/home/ubuntu/WpWebSolucoes"
LOG_FILE="$WORK_DIR/deploy.log"
DEP_FILES=("requirements.txt" "pyproject.toml")
PUSHER="$1"
BRANCH="main"

# === LOG INÍCIO ===
echo "" >> "$LOG_FILE"
echo "=== DEPLOY INICIADO por $PUSHER em $(date) ===" >> "$LOG_FILE"

cd "$WORK_DIR"

# 1. Puxar apenas as mudanças (incremental)
echo "[1/4] git pull (incremental)..." >> "$LOG_FILE"
git pull origin $BRANCH --ff-only >> "$LOG_FILE" 2>&1 || {
    echo "[ERRO] Conflito ou branch divergente!" >> "$LOG_FILE"
    exit 1
}

# 2. Verificar se arquivos de dependência mudaram
DEPS_CHANGED=false
for file in "${DEP_FILES[@]}"; do
    if [ -f "$file" ]; then
        if git diff --quiet HEAD@{1} HEAD -- "$file"; then
            echo "[INFO] $file não mudou" >> "$LOG_FILE"
        else
            echo "[2/4] $file MUDOU → atualizando dependências" >> "$LOG_FILE"
            DEPS_CHANGED=true
        fi
    fi
done

# 3. Atualizar dependências com uv (só se necessário)
if [ "$DEPS_CHANGED" = true ]; then
    echo "[3/4] Executando 'uv sync'..." >> "$LOG_FILE"
    uv sync --frozen >> "$LOG_FILE" 2>&1
else
    echo "[3/4] Sem mudanças em dependências → pulando uv sync" >> "$LOG_FILE"
fi

# 4. Reiniciar app
echo "[4/4] Reiniciando wpwebsolucoes..." >> "$LOG_FILE"
supervisorctl restart wpwebsolucoes >> "$LOG_FILE" 2>&1

# === LOG FIM ===
echo "=== DEPLOY CONCLUÍDO com sucesso em $(date) ===" >> "$LOG_FILE"