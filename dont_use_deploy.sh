#!/bin/bash
set -e

# === CONFIGURAÇÃO ===
WORK_DIR="/home/ubuntu/WpWebSolucoes"
LOG_FILE="$WORK_DIR/deploy.log"
DEP_FILES=("requirements.txt" "pyproject.toml")
PUSHER="${1:-unknown}"
BRANCH="main"
DRY_RUN=false

# === PARÂMETRO OPCIONAL: --dry-run ===
if [ "$2" = "--dry-run" ]; then
    DRY_RUN=true
fi

# === PATH ===
export PATH="$HOME/.cargo/bin:/usr/local/bin:/usr/bin:$PATH"

# === LOG INÍCIO ===
{
  echo ""
  echo "=== DEPLOY INICIADO por $PUSHER em $(date) ==="
  if [ "$DRY_RUN" = true ]; then
      echo "[INFO] Modo de teste (dry-run): Nenhum arquivo será alterado."
  fi
} >> "$LOG_FILE"

cd "$WORK_DIR"

# 1️⃣ Garantir que estamos na branch correta
CURRENT_BRANCH=$(git symbolic-ref --short HEAD || echo "detached")
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "[1/7] Mudando para a branch $BRANCH..." >> "$LOG_FILE"
    git checkout "$BRANCH" >> "$LOG_FILE" 2>&1
fi

# 2️⃣ Buscar atualizações do remoto
echo "[2/7] Buscando atualizações do GitHub..." >> "$LOG_FILE"
git fetch origin "$BRANCH" >> "$LOG_FILE" 2>&1

# 3️⃣ Comparar commits
LOCAL_HASH=$(git rev-parse HEAD)
REMOTE_HASH=$(git rev-parse origin/"$BRANCH")

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
    echo "[3/7] Nenhuma atualização encontrada. Deploy encerrado." >> "$LOG_FILE"
    exit 0
fi

echo "[3/7] Mudanças detectadas: local=$LOCAL_HASH remoto=$REMOTE_HASH" >> "$LOG_FILE"

# 4️⃣ Listar apenas arquivos versionados e existentes no remoto
CHANGED_FILES=$(git diff --name-only --diff-filter=ACMRT "$LOCAL_HASH" "$REMOTE_HASH" | grep -v '^__pycache__/')

if [ -z "$CHANGED_FILES" ]; then
    echo "[4/7] Nenhum arquivo relevante modificado. Encerrando." >> "$LOG_FILE"
    exit 0
fi

echo "[4/7] Arquivos modificados:" >> "$LOG_FILE"
echo "$CHANGED_FILES" >> "$LOG_FILE"

# 5️⃣ Atualizar SOMENTE arquivos modificados e versionados
echo "[5/7] Atualizando arquivos modificados..." >> "$LOG_FILE"

for file in $CHANGED_FILES; do
    # Verificar se o arquivo existe no remoto
    if ! git ls-tree -r origin/"$BRANCH" --name-only | grep -qx "$file"; then
        echo "[5/7] Ignorando $file (não está no remoto ou foi removido)" >> "$LOG_FILE"
        continue
    fi

    if [ "$DRY_RUN" = true ]; then
        echo "[5/7] (dry-run) Atualizaria: $file" >> "$LOG_FILE"
        continue
    fi

    mkdir -p "$(dirname "$file")"
    git checkout origin/"$BRANCH" -- "$file" >> "$LOG_FILE" 2>&1
    echo "[5/7] Atualizado: $file" >> "$LOG_FILE"
done

# 6️⃣ Atualizar dependências se necessário
DEPS_CHANGED=false
for file in "${DEP_FILES[@]}"; do
    if echo "$CHANGED_FILES" | grep -q "^$file$"; then
        echo "[6/7] $file modificado → atualizando dependências (uv sync)" >> "$LOG_FILE"
        DEPS_CHANGED=true
        break
    fi
done

if [ "$DRY_RUN" = true ]; then
    echo "[6/7] (dry-run) Nenhum pacote será instalado." >> "$LOG_FILE"
elif [ "$DEPS_CHANGED" = true ]; then
    uv sync --frozen >> "$LOG_FILE" 2>&1
else
    echo "[6/7] Nenhuma dependência modificada. Pulando atualização de pacotes." >> "$LOG_FILE"
fi

# 7️⃣ Log de finalização
{
  echo "=== DEPLOY FINALIZADO com sucesso em $(date) ==="
  echo "==============================================="
} >> "$LOG_FILE"
echo "[7/7] Deploy concluído com sucesso." >> "$LOG_FILE"
echo "[7/7] Arquivos modificados:" >> "$LOG_FILE"
