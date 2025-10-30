#!/bin/bash
set -e  # Para o script se qualquer comando falhar

WORK_DIR="/home/ubuntu/WpWebSolucoes"
LOG_FILE="$WORK_DIR/deploy.log"
DEP_FILES=("requirements.txt" "pyproject.toml")

echo "=== DEPLOY INICIADO em $(date) por $1 ===" >> "$LOG_FILE"

cd "$WORK_DIR"

# 1. Fazer git pull
echo "[1/4] git pull..." >> "$LOG_FILE"
git fetch origin >> "$LOG_FILE" 2>&1
git reset --hard origin/main >> "$LOG_FILE" 2>&1
git clean -fd >> "$LOG_FILE" 2>&1

# 2. Verificar se dependências mudaram
DEPS_CHANGED=false
for file in "${DEP_FILES[@]}"; do
    if [ -f "$file" ]; then
        if ! git diff --quiet HEAD~1 HEAD -- "$file"; then
            echo "[2/4] $file mudou → atualizando dependências" >> "$LOG_FILE"
            DEPS_CHANGED=true
            break
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

echo "=== DEPLOY CONCLUÍDO em $(date) ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
echo ""