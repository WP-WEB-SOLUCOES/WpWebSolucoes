#!/bin/bash
set -e

# === CONFIGURAÇÃO ===
WORK_DIR="/home/ubuntu/WpWebSolucoes"
LOG_FILE="$WORK_DIR/deploy.log"
DEP_FILES=("requirements.txt" "pyproject.toml")
PUSHER="${1:-unknown}"
BRANCH="main"

# === PATH ===
export PATH="$HOME/.cargo/bin:/usr/local/bin:/usr/bin:$PATH"

# === LOG INÍCIO ===
echo "" >> "$LOG_FILE"
echo "=== DEPLOY FORÇADO por $PUSHER em $(date) ===" >> "$LOG_FILE"

cd "$WORK_DIR"

# 1. FORÇAR ATUALIZAÇÃO DO deploy.sh
echo "[1/5] Forçando deploy.sh do GitHub..." >> "$LOG_FILE"
git fetch origin >> "$LOG_FILE" 2>&1
git checkout origin/$BRANCH -- deploy.sh >> "$LOG_FILE" 2>&1
chmod +x deploy.sh >> "$LOG_FILE" 2>&1

# 2. FORÇAR RESET TOTAL (ignora conflitos locais)
echo "[2/5] Reset HARD para origin/$BRANCH..." >> "$LOG_FILE"
git fetch origin >> "$LOG_FILE" 2>&1
git reset --hard origin/$BRANCH >> "$LOG_FILE" 2>&1
git clean -fd >> "$LOG_FILE" 2>&1

# 3. Verificar mudanças em dependências
DEPS_CHANGED=false
for file in "${DEP_FILES[@]}"; do
    if [ -f "$file" ]; then
        if ! git diff --quiet HEAD@{1} HEAD -- "$file" 2>/dev/null; then
            echo "[3/5] $file MUDOU → atualizando com uv" >> "$LOG_FILE"
            DEPS_CHANGED=true
        fi
    fi
done

# 4. Atualizar dependências (só se necessário)
if [ "$DEPS_CHANGED" = true ]; then
    echo "[4/5] Executando 'uv sync'..." >> "$LOG_FILE"
    uv sync --frozen >> "$LOG_FILE" 2>&1
else
    echo "[4/5] Sem mudanças em dependências → pulando" >> "$LOG_FILE"
fi

# 5. Reiniciar app
echo "[5/5] Reiniciando wpwebsolucoes..." >> "$LOG_FILE"
#supervisorctl restart wpwebsolucoes >> "$LOG_FILE" 2>&1

# === LOG FIM ===
echo "=== DEPLOY CONCLUÍDO COM SUCESSO em $(date) ===" >> "$LOG_FILE"