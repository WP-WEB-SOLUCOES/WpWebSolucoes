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
{
  echo ""
  echo "=== DEPLOY INICIADO por $PUSHER em $(date) ==="
} >> "$LOG_FILE"

cd "$WORK_DIR"

# 1. Buscar atualizações do repositório
echo "[1/6] Buscando atualizações do GitHub..." >> "$LOG_FILE"
git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1

# 2. Verificar se há mudanças
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/"$BRANCH")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo "[2/6] Nenhuma atualização encontrada. Deploy encerrado." >> "$LOG_FILE"
    exit 0
fi

echo "[2/6] Detectadas mudanças no repositório..." >> "$LOG_FILE"

# 3. Obter lista de arquivos modificados
CHANGED_FILES=$(git diff --name-only "$LOCAL_HASH" "$REMOTE_HASH")
echo "[3/6] Arquivos modificados:" >> "$LOG_FILE"
echo "$CHANGED_FILES" >> "$LOG_FILE"

# 4. Atualizar apenas arquivos modificados
echo "[4/6] Atualizando arquivos modificados..." >> "$LOG_FILE"
for file in $CHANGED_FILES; do
    # Criar diretórios se necessário
    mkdir -p "$(dirname "$file")"
    git checkout origin/"$BRANCH" -- "$file" >> "$LOG_FILE" 2>&1
done

# 5. Verificar se dependências mudaram
DEPS_CHANGED=false
for file in "${DEP_FILES[@]}"; do
    if echo "$CHANGED_FILES" | grep -q "^$file$"; then
        echo "[5/6] $file modificado → atualizando dependências com uv" >> "$LOG_FILE"
        DEPS_CHANGED=true
    fi
done

# 6. Atualizar dependências se necessário
if [ "$DEPS_CHANGED" = true ]; then
    uv sync --frozen >> "$LOG_FILE" 2>&1
else
    echo "[5/6] Nenhuma mudança em dependências → pulando atualização de pacotes" >> "$LOG_FILE"
fi

# 7. Log de finalização
{
  echo "=== DEPLOY FINALIZADO com sucesso em $(date) ==="
} >> "$LOG_FILE"
