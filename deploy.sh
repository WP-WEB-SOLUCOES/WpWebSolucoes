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

# 1. Garantir que estamos na branch correta
CURRENT_BRANCH=$(git symbolic-ref --short HEAD || echo "detached")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "[1/7] Mudando para a branch $BRANCH..." >> "$LOG_FILE"
    git checkout "$BRANCH" >> "$LOG_FILE" 2>&1
fi

# 2. Buscar atualizações do remoto
echo "[2/7] Buscando atualizações do GitHub..." >> "$LOG_FILE"
git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1

# 3. Comparar commits
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/"$BRANCH")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo "[3/7] Nenhuma atualização encontrada. Deploy encerrado." >> "$LOG_FILE"
    exit 0
fi

echo "[3/7] Mudanças detectadas: local=$LOCAL_HASH remoto=$REMOTE_HASH" >> "$LOG_FILE"

# 4. Listar arquivos alterados
CHANGED_FILES=$(git diff --name-only "$LOCAL_HASH" "$REMOTE_HASH")
echo "[4/7] Arquivos modificados:" >> "$LOG_FILE"
echo "$CHANGED_FILES" >> "$LOG_FILE"

if [ -z "$CHANGED_FILES" ]; then
    echo "[4/7] Nenhum arquivo detectado como modificado. Encerrando." >> "$LOG_FILE"
    exit 0
fi

# 5. Atualizar SOMENTE os arquivos modificados
echo "[5/7] Atualizando arquivos modificados..." >> "$LOG_FILE"
for file in $CHANGED_FILES; do
    # Garantir que o diretório existe
    mkdir -p "$(dirname "$file")"
    # Substituir apenas o arquivo modificado
    git checkout origin/"$BRANCH" -- "$file" >> "$LOG_FILE" 2>&1
done

# 6. Atualizar dependências se necessário
DEPS_CHANGED=false
for file in "${DEP_FILES[@]}"; do
    if echo "$CHANGED_FILES" | grep -q "^$file$"; then
        echo "[6/7] $file modificado → atualizando dependências (uv sync)" >> "$LOG_FILE"
        DEPS_CHANGED=true
        break
    fi
done

if [ "$DEPS_CHANGED" = true ]; then
    uv sync --frozen >> "$LOG_FILE" 2>&1
else
    echo "[6/7] Nenhuma dependência modificada. Pulando atualização de pacotes." >> "$LOG_FILE"
fi

# 7. Log de finalização
{
  echo "=== DEPLOY FINALIZADO com sucesso em $(date) ==="
  echo "==============================================="
} >> "$LOG_FILE"
