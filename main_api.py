import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from jose import JWTError, jwt
import argon2
from argon2.exceptions import VerifyMismatchError
import uuid

# --- Configuração de Autenticação (JWT) ---
SECRET_KEY = "SUA_CHAVE_SECRETA_MUITO_SEGURA_AQUI"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# --- Configura o Argon2 ---
ph = argon2.PasswordHasher()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(
    title="Chat Admin API",
    description="Backend para o sistema de Chat Admin",
    version="1.0.0"
)

# --- Configuração do CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Modelos de Dados (Pydantic) ---
class User(BaseModel):
    email: str
    name: str
    avatar: Optional[str] = None

class UserInDB(User):
    hashed_password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    avatar: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class ClientInfo(BaseModel):
    email: str
    phone: str
    # CAMPOS DA SOLICITAÇÃO ANTERIOR (origem e tempo)
    source: Optional[str] = None 
    timeOnPage: Optional[str] = None
    # NOVOS CAMPOS DO SEU FORMULÁRIO
    project: Optional[str] = None
    urgency: Optional[str] = None

class Conversation(BaseModel):
    id: str
    clientName: str
    lastMessage: str
    unread: int
    time: str
    status: str # 'waiting', 'active', 'closed'
    clientInfo: ClientInfo
    messages: List[Dict[str, Any]]
    tags: List[str]
    agent_name: Optional[str] = None # <-- NOVO: Registra quem atendeu

class Message(BaseModel):
    id: str
    content: str
    sender: str
    timestamp: datetime
    status: str

class MessageCreate(BaseModel):
    content: str

class QuickTemplate(BaseModel):
    id: str
    title: str
    content: str
    icon: str

class Agent(BaseModel):
    id: int
    name: str
    status: str
    department: str
    avatar: str

class TransferRequest(BaseModel):
    agent_id: int

class StatusRequest(BaseModel):
    status: str


# --- "Banco de Dados" em Memória ---
fake_users_db = {
    "atendente@wpwebsolucoes.com.br": {
        "email": "atendente@wpwebsolucoes.com.br",
        "name": "João Atendente",
        "avatar": None,
        "hashed_password": "$argon2id$v=19$m=65536,t=3,p=4$zJ/rOa71pWhu0QzYk1n1fA$sZgJc6dD+eEzAEjs3FvDaDHdG3T+m3y5qmWxJPOvF0c",
    },
    "admin@wpwebsolucoes.com.br": {
        "email": "admin@wpwebsolucoes.com.br",
        "name": "Administrador",
        "avatar": None,
        "hashed_password": "$argon2id$v=19$m=65536,t=3,p=4$j/uiv0hBfUXfBw0vC2j9iQ$qM6JkP52v6IfvGgA3YkLpGgP+w31YVf2W/vxaqYwE5A",
    }
}
# DB de conversas agora rastreia chats ativos e fechados
fake_conversations_db: Dict[str, Conversation] = {}
fake_templates_db: Dict[str, QuickTemplate] = {
    "saudacao": QuickTemplate(id="saudacao", title="Saudação", content="Olá! Em que posso ajudar você hoje? 😊", icon="hand-wave"),
    "orcamento": QuickTemplate(id="orcamento", title="Orçamento", content="Para prepararmos um orçamento...", icon="dollar-sign")
}
fake_agents_db: List[Agent] = [
    Agent(id=1, name='João Atendente', status='online', department='Suporte', avatar='👨‍💻'),
    Agent(id=2, name='Administrador', status='online', department='Geral', avatar='👩‍💼')
]

# --- Funções Auxiliares de Autenticação ---
def verify_password(plain_password, hashed_password):
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except VerifyMismatchError: return False
    except Exception: return False

def get_password_hash(password):
    return ph.hash(password)

def get_user(db: dict, email: str) -> Optional[UserInDB]:
    if email in db:
        return UserInDB(**db[email])
    return None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user_from_token(token: str) -> Optional[User]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: return None
        user_dict = fake_users_db.get(email)
        if user_dict is None: return None
        return User(**user_dict)
    except JWTError:
        return None

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    user = await get_current_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não foi possível validar as credenciais",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- Endpoints da API (HTTP) ---
# (As rotas /token, /register, /users/me, /templates, /agents... continuam iguais)

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(fake_users_db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos")
    if ph.check_needs_rehash(user.hashed_password):
        user.hashed_password = get_password_hash(form_data.password)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate):
    if user_data.email in fake_users_db:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Este e-mail já está cadastrado.")
    if len(user_data.password) < 6:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A senha deve ter pelo menos 6 caracteres.")
    hashed_password = get_password_hash(user_data.password)
    new_user_db_entry = user_data.dict()
    new_user_db_entry["hashed_password"] = hashed_password
    del new_user_db_entry["password"]
    fake_users_db[user_data.email] = new_user_db_entry
    return User(**new_user_db_entry)

@app.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/conversations", response_model=List[Conversation])
async def get_conversations(current_user: User = Depends(get_current_user)):
    # NOVO: Retorna TODAS as conversas (ativas, em espera e fechadas)
    # O dashboard do agente deve carregar todas e filtrar/ordenar
    print(f"Retornando {len(fake_conversations_db)} conversas totais para o dashboard.")
    return list(fake_conversations_db.values())

@app.get("/templates", response_model=List[QuickTemplate])
async def get_quick_templates(current_user: User = Depends(get_current_user)):
    return list(fake_templates_db.values())

@app.get("/agents", response_model=List[Agent])
async def get_agents(current_user: User = Depends(get_current_user)):
    return fake_agents_db
# ... (outras rotas HTTP) ...


# ---
# --- IMPLEMENTAÇÃO DO WEBSOCKET
# ---

class ConnectionManager:
    def __init__(self):
        self.available_agents: Dict[WebSocket, User] = {}
        self.waiting_guests: List[Tuple[WebSocket, dict, str]] = [] # (websocket, user_join_data, guest_id)
        self.sessions: Dict[WebSocket, WebSocket] = {} # guest_ws -> agent_ws
        self.reverse_sessions: Dict[WebSocket, WebSocket] = {} # agent_ws -> guest_ws
        self.agent_user_map: Dict[WebSocket, User] = {}
        self.guest_id_map: Dict[WebSocket, str] = {} # Mapeia guest_ws -> guest_id

    async def broadcast_to_all_agents(self, message: dict):
        """Envia uma mensagem para TODOS os agentes conectados (disponíveis ou em chat)."""
        print(f"Transmitindo para {len(self.agent_user_map)} agentes: {message.get('type')}")
        for websocket in self.agent_user_map.keys():
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Erro ao transmitir para agente: {e}")

    async def connect_agent(self, websocket: WebSocket, user: User):
        print(f"Agente conectado: {user.email}")
        self.agent_user_map[websocket] = user

        guest_data = self.find_waiting_guest()
        if guest_data:
            guest_ws, join_data, guest_id = guest_data
            
            # Conecta os dois e registra quem atendeu
            self.link_session(guest_ws, websocket, user, guest_id)

            await guest_ws.send_json({
                "type": "transfer_status", "status": "connected",
                "agentName": user.name, "agentRole": "Atendente"
            })
            await websocket.send_json({
                "type": "new_conversation", "guest_id": guest_id,
                "userData": join_data.get("userData"),
                "conversationHistory": join_data.get("conversationHistory")
            })
        else:
            self.available_agents[websocket] = user
            await websocket.send_json({"type": "status", "message": "online_waiting"})
            print(f"Agente {user.email} está online e aguardando.")

    async def connect_guest(self, websocket: WebSocket, join_data: dict):
        guest_id = str(uuid.uuid4())
        self.guest_id_map[websocket] = guest_id

        # --- LÓGICA DE PARSING ATUALIZADA ---
        # 1. Pega o payload de dados do cliente enviado pelo ChatWebSocket
        user_data = join_data.get("userData", {})
        if not user_data:
            print(f"Cliente {guest_id} conectado sem dados (userData). Usando padrões.")

        # 2. Pega o histórico da conversa com a IA
        ai_history = join_data.get("conversationHistory", [])

        # 3. Cria a primeira mensagem (vinda do formulário)
        initial_message_content = user_data.get("message") or "Cliente iniciou o chat."
        first_message = {
            "id": str(uuid.uuid4()),
            "content": initial_message_content,
            "sender": "client",  # Marcado como cliente
            "timestamp": user_data.get("timestamp", datetime.now().isoformat()),
            "status": "sent"
        }

        # 4. Junta o histórico da IA com a primeira mensagem do formulário
        all_messages = ai_history + [first_message]

        # 5. Pega o nome do cliente (do formulário ou usa um padrão)
        client_name = user_data.get('name', f"Cliente {guest_id[:4]}")
        print(f"Cliente conectado: {client_name} (ID: {guest_id})")

        # 6. Cria o objeto ClientInfo com todos os dados
        client_info_data = ClientInfo(
            email=user_data.get('email', 'N/A'),
            phone=user_data.get('phone', 'N/A'),
            source=user_data.get('source', 'N/A'),
            timeOnPage=user_data.get('timeOnPage', 'N/A'),
            project=user_data.get('project', 'Não informado'),
            urgency=user_data.get('urgency', 'Não informado')
        )
        # --- FIM DA LÓGICA DE PARSING ---

        # --- Cria a Conversa no "DB" ---
        new_conv = Conversation(
            id=guest_id,
            clientName=client_name,
            lastMessage=initial_message_content,
            unread=1,
            time=datetime.now().strftime("%H:%M"),
            status='waiting',
            clientInfo=client_info_data,
            messages=all_messages,
            tags=["Novo Cliente"]
        )
        fake_conversations_db[guest_id] = new_conv
        # -------------------------------------

        agent_data = self.find_available_agent()
        if agent_data:
            agent_ws, agent_user = agent_data

            # Conecta os dois e registra quem atendeu
            self.link_session(
                guest_ws=websocket,
                agent_ws=agent_ws,
                agent_user=agent_user,
                guest_id=guest_id
            )

            await websocket.send_json({
                "type": "transfer_status",
                "status": "connected",
                "agentName": agent_user.name,
                "agentRole": "Atendente"
            })

            # Envia a conversa completa para o agente
            await agent_ws.send_json({
                "type": "new_conversation",
                "conversation": new_conv.dict()
            })
        else:
            self.waiting_guests.append((websocket, join_data, guest_id))
            print(f"Cliente {guest_id} colocado na fila. Posição: {len(self.waiting_guests)}")

            # Transmite a nova conversa em espera para TODOS os agentes
            await self.broadcast_to_all_agents({
                "type": "new_waiting_guest",
                "conversation": new_conv.dict()
            })

            await websocket.send_json({
                "type": "transfer_status",
                "status": "waiting",
                "position": len(self.waiting_guests),
                "waitTime": 5
            })

    async def disconnect(self, websocket: WebSocket):
        print("Conexão perdida.")
        conversation_to_update = None
        guest_id = None
        
        if websocket in self.available_agents:
            del self.available_agents[websocket]
            if websocket in self.agent_user_map: del self.agent_user_map[websocket]
            print("Agente disponível desconectado.")
            
        elif websocket in self.reverse_sessions:
            guest_ws = self.reverse_sessions.pop(websocket)
            del self.sessions[guest_ws]
            if websocket in self.agent_user_map: del self.agent_user_map[websocket]
            guest_id = self.guest_id_map.pop(guest_ws, None)
            print(f"Agente em chat com {guest_id} desconectado.")
            try:
                await guest_ws.send_json({"type": "agent_left", "message": "O atendente se desconectou."})
                await guest_ws.close()
            except Exception: pass
        
        elif websocket in self.sessions:
            agent_ws = self.sessions.pop(websocket)
            del self.reverse_sessions[agent_ws]
            guest_id = self.guest_id_map.pop(websocket, None)
            print(f"Cliente {guest_id} em chat desconectado.")
            try:
                await agent_ws.send_json({"type": "guest_left", "message": "O cliente se desconectou."})
                agent_user = self.get_agent_user(agent_ws)
                if agent_user:
                    self.available_agents[agent_ws] = agent_user
                    print(f"Agente {agent_user.email} de volta ao pool.")
            except Exception: pass

        else:
            self.waiting_guests = [entry for entry in self.waiting_guests if entry[0] != websocket]
            guest_id = self.guest_id_map.pop(websocket, None)
            print(f"Cliente {guest_id} na fila desconectado.")

        # --- NOVO: Atualiza o status da conversa para 'closed' e transmite ---
        if guest_id and guest_id in fake_conversations_db:
            conv = fake_conversations_db[guest_id]
            conv.status = 'closed'
            conv.lastMessage = "Conversa encerrada."
            await self.broadcast_to_all_agents({
                "type": "conversation_update",
                "conversation": conv.dict()
            })
        # -----------------------------------------------------------------

    def find_available_agent(self) -> Optional[Tuple[WebSocket, User]]:
        if self.available_agents:
            return self.available_agents.popitem()
        return None

    def find_waiting_guest(self) -> Optional[Tuple[WebSocket, dict, str]]:
        if self.waiting_guests:
            return self.waiting_guests.pop(0)
        return None

    def link_session(self, guest_ws: WebSocket, agent_ws: WebSocket, agent_user: User, guest_id: str):
        """Liga os dois websockets e REGISTRA quem atendeu."""
        self.sessions[guest_ws] = agent_ws
        self.reverse_sessions[agent_ws] = guest_ws
        
        # --- NOVO: Registra o atendimento e transmite a atualização ---
        conv = fake_conversations_db.get(guest_id)
        if conv:
            conv.status = 'active'
            conv.agent_name = agent_user.name # <-- REGISTRO DE QUEM ATENDEU
            conv.unread = 0
            conv.lastMessage = "Atendente conectado."
            print(f"Agente {agent_user.name} atendeu cliente {conv.clientName}")
            
            # Transmite para todos os agentes que esta conversa foi "reivindicada"
            # (asyncio.create_task para não bloquear)
            import asyncio
            asyncio.create_task(self.broadcast_to_all_agents({
                "type": "conversation_update",
                "conversation": conv.dict()
            }))
        # -------------------------------------------------------------

    def get_agent_user(self, agent_ws: WebSocket) -> Optional[User]:
        return self.agent_user_map.get(agent_ws)

    async def forward_to_agent(self, guest_ws: WebSocket, message_data: dict):
        """Envia mensagem do cliente para o agente ou armazena na fila."""
        agent_ws = self.sessions.get(guest_ws)

        if agent_ws:
            # --- CASO 1: Cliente está em sessão ---
            # Encaminha a mensagem completa (com timestamp) para o agente
            await agent_ws.send_json({
                "type": "client_message",
                "message": message_data.get("message"),
                "timestamp": message_data.get("timestamp")})
        else:
            # --- CASO 2: Cliente não está em sessão (está na fila) ---
            # Procura o cliente na fila e anexa a mensagem ao histórico.
            for i, (ws, join_data) in enumerate(self.waiting_guests):
                if ws == guest_ws:
                    client_name = join_data.get("userData", {}).get("name", "Cliente")
                    print(f"Cliente '{client_name}' enviou mensagem da fila. Armazenando.")

                    # Converte a mensagem do formato 'user_message' para o formato 'conversationHistory'
                    new_history_entry = {
                        "text": message_data.get("message"),
                        "isBot": False, # Veio do usuário
                        "timestamp": message_data.get("timestamp")
                    
                    }

                    # Garante que 'conversationHistory' exista e anexa a nova mensagem
                    history = join_data.get("conversationHistory", [])
                    if history is None: history = [] # Proteção extra
                    history.append(new_history_entry)
                    join_data["conversationHistory"] = history

                    # Atualiza a entrada na fila
                    self.waiting_guests[i] = (ws, join_data)

                    # Notifica o cliente que a mensagem foi recebida
                    # (Usamos 'agent_message' pois o chat-websocket.js já sabe lidar com ele)
                    await guest_ws.send_json({
                        "type": "agent_message",
                        "message": "Sua mensagem foi recebida e será entregue ao próximo agente disponível."
                    })
                    
                    return

            # Se não está em sessão E não está na fila (não deve acontecer)
            print("Erro: Cliente enviou mensagem mas não está em sessão nem na fila.")

    async def forward_to_guest(self, agent_ws: WebSocket, message: str):
        guest_ws = self.reverse_sessions.get(agent_ws)
        if guest_ws:
            # --- NOVO: Atualiza a "lastMessage" no DB ---
            guest_id = self.guest_id_map.get(guest_ws)
            if guest_id and guest_id in fake_conversations_db:
                fake_conversations_db[guest_id].lastMessage = message
            # --------------------------------------------
            await guest_ws.send_json({
                "type": "agent_message",
                "message": message
            })
        else:
            print("Erro: Agente enviou mensagem mas não está em sessão.")

    async def forward_typing_to_guest(self, agent_ws: WebSocket, typing: bool):
        guest_ws = self.reverse_sessions.get(agent_ws)
        if guest_ws:
            await guest_ws.send_json({
                "type": "agent_typing",
                "typing": typing
            })

# Instância global do gerenciador
manager = ConnectionManager()


@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        data = await websocket.receive_json()
        msg_type = data.get("type")

        # --- É UM AGENTE (FUNCIONÁRIO) ---
        if msg_type == "agent_auth":
            token = data.get("token")
            user = await get_current_user_from_token(token)
            if not user:
                await websocket.close(code=1008, reason="Token inválido")
                return
            
            await manager.connect_agent(websocket, user)
            
            try:
                while True:
                    data = await websocket.receive_json()
                    evt_type = data.get("type")
                    if evt_type == "agent_message":
                        await manager.forward_to_guest(websocket, data.get("message"))
                    elif evt_type == "agent_typing":
                        await manager.forward_typing_to_guest(websocket, data.get("typing"))
            except WebSocketDisconnect:
                await manager.disconnect(websocket)
            
        # --- É UM CLIENTE (VISITANTE) ---
        elif msg_type == "user_join":
            await manager.connect_guest(websocket, data)
            
            try:
                while True:
                    data = await websocket.receive_json()
                    evt_type = data.get("type")
                    if evt_type == "user_message":
                        await manager.forward_to_agent(websocket, data)
            except WebSocketDisconnect:
                await manager.disconnect(websocket)
                
        else:
            await websocket.close(code=1003, reason="Tipo de mensagem inicial inválido")

    except WebSocketDisconnect:
        print("Desconectado antes da autenticação.")
    except Exception as e:
        print(f"Erro no WebSocket: {e}")
        await manager.disconnect(websocket) # Garante que a desconexão seja tratada


# Ponto de entrada
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)