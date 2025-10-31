// Chat IA Agent - Versão Melhorada com WebSocket Integration
class ChatIA {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isTyping = false;
        this.conversationContext = [];
        this.waitingForHuman = false;
        this.humanChatActive = false; // NOVO: Controla se está em modo humano
        this.startTime = Date.now()
        this.pendingHumanTranfer = false;
        this.sessionId = this.getOrCreateSessionId();

        this.initializeChat();
        this.restorePreviousSession(); // NOVO: Restaura sessão anterior
    }

    // NOVO: Sistema de sessão com cookies
    getOrCreateSessionId() {
        let sessionId = this.getCookie('chat_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            this.setCookie('chat_session_id', sessionId, 15); // 15 minutos
        }
        return sessionId;
    }

    setCookie(name, value, minutes) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (minutes * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // NOVO: Restaura sessão anterior se existir
    restorePreviousSession() {
        const savedState = localStorage.getItem(`chat_state_${this.sessionId}`);
        if (savedState) {
            try {
                const state = JSON.parse(savedState);
                this.humanChatActive = state.humanChatActive || false;
                this.waitingForHuman = state.waitingForHuman || false;

                if (this.humanChatActive) {
                    // Se tinha um chat humano ativo, tenta reconectar
                    setTimeout(() => this.initializeWebSocket(), 1000);
                }
            } catch (e) {
                console.log('Não foi possível restaurar sessão anterior');
            }
        }
    }

    // NOVO: Salva estado atual
    saveState() {
        const state = {
            humanChatActive: this.humanChatActive,
            waitingForHuman: this.waitingForHuman,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(`chat_state_${this.sessionId}`, JSON.stringify(state));
    }

    // NOVO: Limpa estado (quando chat é fechado completamente)
    clearState() {
        localStorage.removeItem(`chat_state_${this.sessionId}`);
        this.setCookie('chat_session_id', '', -1); // Expira cookie
    }

    initializeChat() {
        this.createChatHTML();
        this.bindEvents();

        // Só carrega mensagem de boas-vindas se não estiver em modo humano
        if (!this.humanChatActive) {
            this.loadWelcomeMessage();
        }
    }

    createChatHTML() {
        const chatHTML = `
            <div class="chat-widget">
                <div class="chat-container" id="chatContainer">
                    <div class="chat-header">
                        <div class="chat-header-info">
                            <div class="chat-avatar">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="chat-agent-info">
                                <h3 id="chatAgentName">Assistente IA</h3>
                                <p id="chatAgentStatus">Online • WP Web Soluções</p>
                            </div>
                        </div>
                        <button class="chat-close" id="chatClose">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="chat-messages" id="chatMessages">
                        <!-- Mensagens serão inseridas aqui -->
                    </div>

                    <div class="chat-typing" id="chatTyping">
                        <div class="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>

                    <div class="chat-transfer" id="chatTransfer">
                        <div class="transfer-message">
                            <i class="fas fa-user-headset"></i>
                            <span>Transferindo para atendente humano...</span>
                        </div>
                    </div>
                    
                    <div class="chat-input-container">
                        <textarea 
                            class="chat-input" 
                            id="chatInput" 
                            placeholder="Digite sua mensagem..." 
                            rows="1"
                        ></textarea>
                        <button class="chat-send" id="chatSend">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
                
                <button class="chat-button pulse" id="chatButton">
                    <i class="fas fa-comments"></i>
                </button>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }

    bindEvents() {
        const chatButton = document.getElementById('chatButton');
        const chatClose = document.getElementById('chatClose');
        const chatSend = document.getElementById('chatSend');
        const chatInput = document.getElementById('chatInput');

        chatButton.addEventListener('click', () => this.toggleChat());
        chatClose.addEventListener('click', () => this.closeChat());
        chatSend.addEventListener('click', () => this.sendMessage());

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        chatInput.addEventListener('input', this.autoResize.bind(this));
    }

    autoResize() {
        const textarea = document.getElementById('chatInput');
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }

    toggleChat() {
        const chatContainer = document.getElementById('chatContainer');
        const chatButton = document.getElementById('chatButton');

        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            chatContainer.classList.add('active');
            chatButton.classList.remove('pulse');
            document.getElementById('chatInput').focus();

            // Se está em modo humano, mostra estado atual
            if (this.humanChatActive) {
                this.updateInterfaceForHumanMode();
            } else if (this.messages.length === 0) {
                this.loadWelcomeMessage();
            }
        } else {
            chatContainer.classList.remove('active');
        }
    }

    closeChat() {
        this.isOpen = false;
        document.getElementById('chatContainer').classList.remove('active');
    }

    loadWelcomeMessage() {
        const welcomeMessage = {
            text: `👋 Olá! Sou o **Assistente IA da WP Web Soluções**

Estou aqui para ajudar você com:

📱 **Desenvolvimento** de apps, sites e sistemas
💰 **Orçamentos** e prazos de entrega
🚀 **Processo** de desenvolvimento
👥 **Conexão** com nossos especialistas

Posso responder perguntas técnicas, explicar nossos serviços ou conectar você com um atendente humano quando precisar.

**Como posso ajudar você hoje?**`,
            isBot: true,
            timestamp: new Date()
        };

        this.addMessage(welcomeMessage);
        this.showQuickActions();
    }

    showQuickActions() {
        const quickActions = [
            "💻 Desenvolvimento de Apps",
            "🌐 Sites Institucionais",
            "🚀 Sistemas Web Personalizados",
            "💰 Solicitar Orçamento",
            "👥 Falar com Atendente"
        ];

        const quickActionsHTML = quickActions.map(action =>
            `<div class="quick-action" data-action="${action}">${action}</div>`
        ).join('');

        const quickActionsContainer = document.createElement('div');
        quickActionsContainer.className = 'quick-actions';
        quickActionsContainer.innerHTML = quickActionsHTML;

        document.getElementById('chatMessages').appendChild(quickActionsContainer);

        quickActionsContainer.querySelectorAll('.quick-action').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });
    }

    handleQuickAction(action) {
        document.querySelector('.quick-actions')?.remove();

        this.addMessage({
            text: action,
            isBot: false,
            timestamp: new Date()
        });

        if (action.includes("👥 Falar com Atendente")) {
            this.transferToHuman();
        } else if (!this.humanChatActive) { // Só responde com IA se não estiver em modo humano
            this.generateBotResponse(action);
        }
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (message && !this.isTyping) {
            document.querySelector('.quick-actions')?.remove();

            this.addMessage({
                text: message,
                isBot: false,
                timestamp: new Date()
            });

            input.value = '';
            this.autoResize();

            // 🔒 BLOQUEIO DA IA: Se está em modo humano, só usa WebSocket
            if (this.humanChatActive) {
                if (window.chatWebSocket) {
                    window.chatWebSocket.sendMessage(message);
                } else {
                    this.addMessage({
                        text: "⚠️ **Conexão perdida**\n\nTentando reconectar com o atendente...",
                        isBot: true,
                        timestamp: new Date()
                    });
                    this.initializeWebSocket();
                }
            } else {
                // Modo IA normal
                this.generateBotResponse(message);
            }
        }
    }

    addMessage(message) {
        const messagesContainer = document.getElementById('chatMessages');

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.isBot ? 'bot' : 'user'}`;

        const time = message.timestamp.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageElement.innerHTML = `
            <div class="message-text">${this.formatMessage(message.text)}</div>
            <div class="message-time">${time}</div>
        `;

        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        this.messages.push(message);
        this.conversationContext.push({
            role: message.isBot ? 'assistant' : 'user',
            content: message.text
        });

        // Keep only last 10 messages for context
        if (this.conversationContext.length > 10) {
            this.conversationContext = this.conversationContext.slice(-10);
        }
    }

    formatMessage(text) {
        return text.replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    showTypingIndicator() {
        this.isTyping = true;
        document.getElementById('chatTyping').classList.add('active');
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    }

    hideTypingIndicator() {
        this.isTyping = false;
        document.getElementById('chatTyping').classList.remove('active');
    }

    showTransferIndicator() {
        document.getElementById('chatTransfer').style.display = 'block';
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    }

    hideTransferIndicator() {
        document.getElementById('chatTransfer').style.display = 'none';
    }

    async generateBotResponse(userMessage) {
        // 🔒 BLOQUEIO: Não responde se está em modo humano
        if (this.humanChatActive) {
            return;
        }

        this.showTypingIndicator();

        try {
            const response = await this.getAIResponse(userMessage);

            setTimeout(() => {
                this.hideTypingIndicator();
                this.addMessage({
                    text: response,
                    isBot: true,
                    timestamp: new Date()
                });

                if (!this.waitingForHuman && !userMessage.includes('👥')) {
                    setTimeout(() => this.showQuickActions(), 1000);
                }
            }, 1500 + Math.random() * 1000);

        } catch (error) {
            console.error('Erro na IA:', error);
            this.hideTypingIndicator();
            this.addMessage({
                text: "Desculpe, estou com dificuldades técnicas. Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp: (31) 99754-2811",
                isBot: true,
                timestamp: new Date()
            });
        }
    }

    async getAIResponse(userMessage) {
        // Primeiro, verifica se é uma solicitação de atendente humano
        if (this.shouldTransferToHuman(userMessage)) {
            this.transferToHuman();
            return "Perfeito! Vou conectar você com um de nossos especialistas humanos. Um momento por favor...";
        }

        // Tenta responder com base no contexto conhecido
        const contextualResponse = this.getContextualResponse(userMessage);
        if (contextualResponse) {
            return contextualResponse;
        }

        // Para mensagens fora do contexto, usa uma abordagem mais inteligente
        return this.handleUnknownQuery(userMessage);
    }

    transferToHuman() {
        this.pendingHumanTransfer = true; // ⬅️ MARCA QUE ESTÁ AGUARDANDO FORMULÁRIO

        // Esconde ações rápidas
        document.querySelector('.quick-actions')?.remove();

        // Mostra formulário de informações do cliente
        this.showClientInfoForm();
    }

    getContextualResponse(userMessage) {
        const lowerMessage = userMessage.toLowerCase();

        // Serviços principais
        if (lowerMessage.includes('app') || lowerMessage.includes('aplicativo') || lowerMessage.includes('mobile')) {
            return this.getAppDevelopmentResponse();
        }

        if (lowerMessage.includes('site') || lowerMessage.includes('institucional') || lowerMessage.includes('landing page')) {
            return this.getWebDevelopmentResponse();
        }

        if (lowerMessage.includes('sistema') || lowerMessage.includes('plataforma') || lowerMessage.includes('software')) {
            return this.getSystemDevelopmentResponse();
        }

        if (lowerMessage.includes('orçamento') || lowerMessage.includes('preço') || lowerMessage.includes('custo') || lowerMessage.includes('valor')) {
            return this.getPricingResponse();
        }

        if (lowerMessage.includes('processo') || lowerMessage.includes('como funciona') || lowerMessage.includes('metodologia')) {
            return this.getProcessResponse();
        }

        if (lowerMessage.includes('tecnolog') || lowerMessage.includes('stack') || lowerMessage.includes('ferramenta')) {
            return this.getTechStackResponse();
        }

        // Perguntas sobre a empresa
        if (lowerMessage.includes('empresa') || lowerMessage.includes('wp web') || lowerMessage.includes('quem são')) {
            return this.getCompanyResponse();
        }

        // Tempo e prazos
        if (lowerMessage.includes('tempo') || lowerMessage.includes('prazo') || lowerMessage.includes('quando') || lowerMessage.includes('dura')) {
            return this.getTimelineResponse();
        }

        return null;
    }

    handleUnknownQuery(userMessage) {
        // Analisa a intenção da mensagem
        if (this.isGreeting(userMessage)) {
            return "Olá! 😊 É um prazer conversar com você! Como posso ajudar com nossos serviços de desenvolvimento?";
        }

        if (this.isThanks(userMessage)) {
            return "De nada! Fico feliz em ajudar. 😊 Há mais alguma coisa sobre nossos serviços que gostaria de saber?";
        }

        if (this.isFarewell(userMessage)) {
            return "Obrigado pela conversa! Se tiver mais dúvidas sobre desenvolvimento, estarei aqui. Tenha um ótimo dia! 🌟";
        }

        // Para perguntas técnicas complexas ou fora do escopo
        if (this.isTechnicalQuestion(userMessage)) {
            return `🤔 **Pergunta Técnica Interessante**

Sua pergunta sobre "${userMessage.substring(0, 50)}..." é bastante específica.

Para garantir uma resposta precisa e detalhada, recomendo:

1. **Conversar com nosso especialista técnico** - posso conectar você agora mesmo
2. **Agendar uma call técnica** - sem compromisso
3. **Enviar sua pergunta por email** para nossa equipe analisar

O que prefere? Posso transferir para um atendente humano que terá todo o conhecimento para ajudar!`;
        }

        // Resposta genérica para mensagens não reconhecidas
        return `🤖 **Assistente IA WP Web Soluções**

Entendi que você perguntou sobre: "${userMessage}"

Como sou um assistente focado em **desenvolvimento de software**, posso ajudar melhor com:

• Desenvolvimento de **apps, sites e sistemas**
• **Tecnologias** que utilizamos (Flutter, React, Python, etc.)
• **Processos** de desenvolvimento e prazos
• **Orçamentos** e investimentos

Se sua pergunta for sobre outros assuntos ou precisar de um atendimento mais específico, posso conectar você com nosso time humano!

**Como posso auxiliar melhor você?**`;
    }

    // Métodos de detecção de intenção
    isGreeting(message) {
        const greetings = ['oi', 'olá', 'ola', 'hey', 'e aí', 'eai', 'bom dia', 'boa tarde', 'boa noite'];
        return greetings.some(greet => message.toLowerCase().includes(greet));
    }

    isThanks(message) {
        const thanks = ['obrigado', 'obrigada', 'valeu', 'agradeço', 'thanks', 'thank you'];
        return thanks.some(thank => message.toLowerCase().includes(thank));
    }

    isFarewell(message) {
        const farewells = ['tchau', 'bye', 'até mais', 'ate mais', 'flw', 'falou', 'adeus'];
        return farewells.some(farewell => message.toLowerCase().includes(farewell));
    }

    isTechnicalQuestion(message) {
        const techKeywords = ['como fazer', 'como implementar', 'melhor prática', 'arquitetura', 'api', 'database', 'backend', 'frontend'];
        return techKeywords.some(keyword => message.toLowerCase().includes(keyword));
    }

    // Respostas específicas
    getAppDevelopmentResponse() {
        return `📱 **Desenvolvimento de Apps Mobile**

Desenvolvemos aplicativos **nativos e híbridos** para iOS e Android:

**🚀 Tecnologias:**
• Flutter (Cross-platform)
• React Native
• Swift (iOS nativo)
• Kotlin (Android nativo)

**💡 O que incluímos:**
• Design UI/UX personalizado
• Desenvolvimento completo
• Integração com APIs
• Publicação nas lojas
• Manutenção contínua

**⏱️ Tempo:** 2-4 meses
**💰 Investimento:** A partir de R$ 8.000

Tem um projeto específico em mente?`;
    }

    getWebDevelopmentResponse() {
        return `🌐 **Desenvolvimento Web**

Criamos **sites modernos e responsivos**:

**🎨 Tipos de sites:**
• Landing Pages (1-2 semanas)
• Sites Institucionais (3-6 semanas)
• E-commerce (4-8 semanas)
• Portfólios (2-4 semanas)

**⚡ Tecnologias:**
• HTML5/CSS3/JavaScript
• React.js / Vue.js
• WordPress (quando necessário)
• SEO otimizado

**💰 Investimento:** A partir de R$ 1.500

Qual tipo de site você precisa?`;
    }

    getSystemDevelopmentResponse() {
        return `💻 **Sistemas Web Sob Medida**

Desenvolvemos **sistemas completos** para automação empresarial:

**🛠️ Stack Tecnológica:**
• Frontend: React, Vue.js, TypeScript
• Backend: Python/FastAPI, Node.js
• Database: MongoDB, PostgreSQL
• Cloud: AWS, Google Cloud, Oracle

**📊 Funcionalidades Comuns:**
• Dashboards administrativos
• Relatórios em tempo real
• Sistema de usuários
• Integração com APIs externas

**⏱️ Tempo:** 2-5 meses
**💰 Investimento:** A partir de R$ 12.000

Para qual área você precisa do sistema?`;
    }

    getPricingResponse() {
        return `💰 **Informações de Investimento**

**Site Institucional:** R$ 1.500 - R$ 8.000
• Landing Page: R$ 1.500 - R$ 3.000
• Site Corporativo: R$ 3.500 - R$ 8.000

**Aplicativo Mobile:** R$ 8.000 - R$ 25.000+
• App Simples: R$ 8.000 - R$ 15.000  
• App Complexo: R$ 15.000 - R$ 25.000+

**Sistema Web:** R$ 12.000 - R$ 50.000+
• Sistema Básico: R$ 12.000 - R$ 25.000
• Sistema Empresarial: R$ 25.000 - R$ 50.000+

**💎 Incluímos em todos os projetos:**
• Design UI/UX personalizado
• Desenvolvimento completo
• Testes e qualidade
• Deploy e implantação
• Suporte pós-entrega

Posso preparar uma estimativa personalizada?`;
    }

    getProcessResponse() {
        return `🔄 **Nosso Processo de Desenvolvimento**

**1. Discovery (1-2 semanas)**
• Análise de requisitos
• Wireframes e protótipos
• Planejamento detalhado

**2. Design (2-3 semanas)**
• Design de interface
• Experiência do usuário
• Validação com cliente

**3. Desenvolvimento (varia)**
• Sprints de 2 semanas
• Entregas parciais
• Testes contínuos

**4. Entrega & Suporte**
• Deploy e implantação
• Treinamento
• Suporte pós-entrega

**🎯 Taxa de satisfação:** 95% dos clientes`;
    }

    getTechStackResponse() {
        return `🛠️ **Stack Tecnológica**

**Frontend:**
• React.js / Vue.js / TypeScript
• Flutter / React Native
• HTML5 / CSS3 / JavaScript

**Backend:**
• Python + FastAPI
• Node.js + Express
• PHP + Laravel

**Database:**
• MongoDB
• PostgreSQL
• MySQL

**Cloud & DevOps:**
• AWS / Google Cloud
• Docker
• CI/CD

**Ferramentas de IA:**
• TensorFlow
• OpenAI API
• Processamento de linguagem natural

Tem preferência por alguma tecnologia específica?`;
    }

    getCompanyResponse() {
        return `🏢 **WP Web Soluções**

Somos uma empresa especializada em **desenvolvimento de software** com foco em:

**🎯 Nossa Missão:**
Transformar ideias em soluções digitais inovadoras que impulsionam negócios

**💼 O que fazemos:**
• Desenvolvimento de aplicativos mobile
• Criação de sites e sistemas web
• Soluções com inteligência artificial
• Consultoria em tecnologia

**⭐ Diferenciais:**
• Metodologia ágil transparente
• Tecnologias modernas
• Suporte contínuo
• Mais de 50 projetos entregues

**📍 Localização:** Minas Gerais, MG - Brasil

Há mais de 5 anos entregando excelência em desenvolvimento!`;
    }

    getTimelineResponse() {
        return `⏱️ **Prazos de Desenvolvimento**

**Landing Page:** 1-2 semanas
**Site Institucional:** 3-6 semanas  
**E-commerce:** 4-8 semanas
**Aplicativo Mobile:** 2-4 meses
**Sistema Web:** 2-5 meses

**📅 Fatores que influenciam o prazo:**
• Complexidade do projeto
• Número de funcionalidades
• Integrações necessárias
• Revisões solicitadas

**⚡ Aceleramos projetos** quando necessário!

Qual tipo de projeto você tem em mente?`;
    }

    // NOVO: Atualiza interface para modo humano
    updateInterfaceForHumanMode() {
        document.getElementById('chatAgentName').textContent = 'Atendente';
        document.getElementById('chatAgentStatus').textContent = 'Online • Em atendimento';

        // Remove qualquer ação rápida da IA
        document.querySelector('.quick-actions')?.remove();
    }

    // NOVO: Método para voltar para a IA (quando atendente desconecta)
    returnToAIMode() {
        this.humanChatActive = false;
        this.waitingForHuman = false;
        this.saveState();

        document.getElementById('chatAgentName').textContent = 'Assistente IA';
        document.getElementById('chatAgentStatus').textContent = 'Online • WP Web Soluções';

        this.addMessage({
            text: "🔄 **Retornando para o modo assistente IA**\n\nO atendimento humano foi encerrado. Como posso ajudar você agora?",
            isBot: true,
            timestamp: new Date()
        });

        this.showQuickActions();
    }

    transferToHuman() {
        this.pendingHumanTransfer = true; // ⬅️ MARCA QUE ESTÁ AGUARDANDO FORMULÁRIO

        // Esconde ações rápidas
        document.querySelector('.quick-actions')?.remove();

        // Mostra formulário de informações do cliente
        this.showClientInfoForm();
    }

    initializeWebSocket() {
        if (!window.chatWebSocket) {
            window.chatWebSocket = new ChatWebSocket(this);
        }
        window.chatWebSocket.connect();
    }

    // NOVO: Método para mostrar formulário de informações do cliente
    showClientInfoForm() {
        const formHTML = `
        <div class="client-info-form" id="clientInfoForm">
            <div class="form-header">
                <h4>📋 Antes de conectar com nosso atendente</h4>
                <p>Preencha suas informações para agilizar o atendimento:</p>
            </div>
            
            <div class="form-fields">
                <div class="form-group">
                    <label for="clientName">Seu Nome *</label>
                    <input type="text" id="clientName" placeholder="Como gostaria de ser chamado?" required>
                </div>
                
                <div class="form-group">
                    <label for="clientEmail">E-mail *</label>
                    <input type="email" id="clientEmail" placeholder="seu@email.com" required>
                </div>
                
                <div class="form-group">
                    <label for="clientPhone">Telefone/WhatsApp *</label>
                    <input type="tel" id="clientPhone" placeholder="(00) 00000-0000" required>
                </div>
                
                <div class="form-group">
                    <label for="clientProject">Tipo de Projeto</label>
                    <select id="clientProject">
                        <option value="">Selecione uma opção</option>
                        <option value="app">Aplicativo Mobile</option>
                        <option value="site">Site Institucional</option>
                        <option value="ecommerce">Loja Virtual (E-commerce)</option>
                        <option value="sistema">Sistema Web</option>
                        <option value="landing">Landing Page</option>
                        <option value="outro">Outro</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="clientUrgency">Urgência do Projeto</label>
                    <select id="clientUrgency">
                        <option value="baixa">Baixa - Apenas orçamentando</option>
                        <option value="media">Média - Início em 1-2 meses</option>
                        <option value="alta">Alta - Início imediato</option>
                    </select>
                </div>
                
                <div class="form-group full-width">
                    <label for="clientMessage">Mensagem para o atendente</label>
                    <textarea 
                        id="clientMessage" 
                        placeholder="Conte um pouco sobre seu projeto, objetivos ou dúvidas específicas..."
                        rows="3"
                    ></textarea>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-cancel" id="cancelFormBtn">
                    <i class="fas fa-times"></i>
                    Cancelar
                </button>
                <button type="button" class="btn-submit" id="submitFormBtn">
                    <i class="fas fa-user-headset"></i>
                    Conectar com Atendente
                </button>
            </div>
            
            <div class="form-footer">
                <p><small>⚠️ Seus dados estão seguros e serão usados apenas para este atendimento.</small></p>
            </div>
        </div>
    `;

        const formContainer = document.createElement('div');
        formContainer.className = 'message bot';
        formContainer.innerHTML = `
        <div class="message-text">
            ${formHTML}
        </div>
        <div class="message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    `;

        document.getElementById('chatMessages').appendChild(formContainer);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

        // Adiciona eventos ao formulário
        this.bindFormEvents();
    }

    // NOVO: Método para vincular eventos do formulário
    bindFormEvents() {
        const cancelBtn = document.getElementById('cancelFormBtn');
        const submitBtn = document.getElementById('submitFormBtn');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                const formElement = document.getElementById('clientInfoForm');
                if (formElement) {
                    formElement.closest('.message').remove();
                }
                this.pendingHumanTransfer = false;
                this.addMessage({
                    text: "❌ **Solicitação cancelada**\n\nVocê cancelou a solicitação de atendimento humano. Como posso ajudá-lo com nossa IA?",
                    isBot: true,
                    timestamp: new Date()
                });
                this.showQuickActions();
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitClientInfoForm();
            });
        }

        // Enter para submeter formulário
        const form = document.getElementById('clientInfoForm');
        if (form) {
            form.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.submitClientInfoForm();
                }
            });
        }
    }

    // NOVO: Método para submeter formulário
    submitClientInfoForm() {
        const nameInput = document.getElementById('clientName');
        const emailInput = document.getElementById('clientEmail');
        const phoneInput = document.getElementById('clientPhone');

        if (!nameInput || !emailInput || !phoneInput) {
            console.error('Campos do formulário não encontrados');
            return;
        }

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const project = document.getElementById('clientProject').value;
        const urgency = document.getElementById('clientUrgency').value;
        const message = document.getElementById('clientMessage').value.trim();

        const timeOnPage = Math.round((Date.now() - this.startTime) / 1000);
        const origin = document.referrer || 'Acesso Direto';

        // Validação básica
        if (!name || !email || !phone) {
            this.showFormError('Por favor, preencha pelo menos nome, e-mail e telefone.');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showFormError('Por favor, insira um e-mail válido.');
            return;
        }

        // Remove o formulário
        const formElement = document.getElementById('clientInfoForm');
        if (formElement) {
            formElement.closest('.message').remove();
        }

        // Adiciona mensagem de confirmação
        this.addMessage({
            text: `📋 **Informações enviadas!**\n\nObrigado, ${name}! Suas informações foram recebidas e já estamos conectando você com um de nossos especialistas.`,
            isBot: true,
            timestamp: new Date()
        });

        // Prepara dados para envio
        const clientData = {
            name,
            email,
            phone,
            project,
            urgency,
            message,
            timeOnPage: `${timeOnPage} segundos`,
            source: origin,
            page: window.location.href,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        };

        // Inicia a transferência real
        this.startHumanTransfer(clientData);
    }

    // NOVO: Método para validar e-mail
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // NOVO: Método para mostrar erro no formulário
    showFormError(message) {
        let errorElement = document.getElementById('formError');

        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'formError';
            errorElement.className = 'form-error';
            const form = document.getElementById('clientInfoForm');
            if (form) {
                form.insertBefore(errorElement, form.querySelector('.form-actions'));
            }
        }

        errorElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
        errorElement.style.display = 'block';

        // Scroll para o erro
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // NOVO: Método para iniciar transferência com dados do cliente
    // CORRIGIDO: Método para iniciar transferência com dados do cliente
    startHumanTransfer(clientData) {
        this.waitingForHuman = true;
        this.humanChatActive = true;
        this.pendingHumanTransfer = false;
        this.saveState();

        this.showTransferIndicator();

        document.getElementById('chatAgentName').textContent = 'Conectando...';
        document.getElementById('chatAgentStatus').textContent = 'Transferindo para atendente';

        // A linha do bug "conversationContext.push" foi removida daqui.

        // Adiciona mensagem de transição
        this.addMessage({
            text: "🔄 **Conectando com atendente humano...**\n\nAguarde um momento enquanto conectamos você com um de nossos especialistas.",
            isBot: true,
            timestamp: new Date()
        });

        // Inicializa WebSocket com dados do cliente
        this.initializeWebSocket(clientData);
    }

    // ATUALIZADO: Método initializeWebSocket para aceitar dados do cliente
    initializeWebSocket(clientData = null) {
        if (!window.chatWebSocket) {
            window.chatWebSocket = new ChatWebSocket(this);
        }

        // Passa os dados do cliente para o WebSocket
        if (clientData) {
            window.chatWebSocket.clientData = clientData;
        }

        window.chatWebSocket.connect();
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    window.chatIA = new ChatIA();
    console.log('✅ Chat IA inicializado com sucesso');
});