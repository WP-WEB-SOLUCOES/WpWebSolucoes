// Chat IA Agent - Versão Melhorada
class ChatIA {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isTyping = false;
        this.conversationContext = [];
        this.waitingForHuman = false;
        this.initializeChat();
    }

    initializeChat() {
        this.createChatHTML();
        this.bindEvents();
        this.loadWelcomeMessage();
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
            
            // Restore conversation context if exists
            if (this.messages.length === 0) {
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
        } else {
            this.generateBotResponse(action);
        }
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (message && !this.isTyping && !this.waitingForHuman) {
            document.querySelector('.quick-actions')?.remove();

            this.addMessage({
                text: message,
                isBot: false,
                timestamp: new Date()
            });

            input.value = '';
            this.autoResize();

            this.generateBotResponse(message);
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

    shouldTransferToHuman(message) {
        const transferKeywords = [
            'humano', 'atendente', 'pessoa', 'especialista', 'consultor', 'falar com alguém',
            'atendimento humano', 'quero uma pessoa', 'não é robô', 'representante',
            'gerente', 'vendedor', 'consultoria', 'reunião', 'call', 'telefone',
            'whatsapp', 'ligar', 'contato direto'
        ];

        const lowerMessage = message.toLowerCase();
        return transferKeywords.some(keyword => lowerMessage.includes(keyword));
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

    transferToHuman() {
        this.waitingForHuman = true;
        this.showTransferIndicator();
        
        // Esconde ações rápidas
        document.querySelector('.quick-actions')?.remove();
        
        // Atualiza status do chat
        document.getElementById('chatAgentName').textContent = 'Conectando...';
        document.getElementById('chatAgentStatus').textContent = 'Transferindo para atendente';

        // Simula conexão com WebSocket
        setTimeout(() => {
            this.hideTransferIndicator();
            
            // Inicializa WebSocket para atendimento humano
            this.initializeHumanChat();
            
        }, 2000);
    }

    initializeHumanChat() {
        // Aqui você integraria com o WebSocket real
        // Por enquanto, vamos simular
        
        document.getElementById('chatAgentName').textContent = 'Atendente';
        document.getElementById('chatAgentStatus').textContent = 'Online • WP Web Soluções';
        
        this.addMessage({
            text: `👋 Olá! Sou o **Atendente da WP Web Soluções**

Vi que você estava conversando com nosso assistente IA e preferiu falar comigo.

Em que posso ajudar? Pode me contar mais sobre seu projeto ou dúvida!`,
            isBot: true,
            timestamp: new Date()
        });

        // Mostra que agora é atendimento humano
        this.showHumanQuickActions();
    }

    showHumanQuickActions() {
        const humanActions = [
            "📞 Agendar Call de Apresentação",
            "💬 Conversar por WhatsApp", 
            "📧 Enviar Email Detalhado",
            "💰 Solicitar Proposta Formal",
            "🔄 Voltar para IA"
        ];

        const actionsHTML = humanActions.map(action => 
            `<div class="quick-action human-action" data-action="${action}">${action}</div>`
        ).join('');

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'quick-actions';
        actionsContainer.innerHTML = actionsHTML;

        document.getElementById('chatMessages').appendChild(actionsContainer);
        
        actionsContainer.querySelectorAll('.quick-action').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                this.handleHumanAction(action);
            });
        });
    }

    handleHumanAction(action) {
        document.querySelector('.quick-actions')?.remove();
        
        this.addMessage({
            text: action,
            isBot: false,
            timestamp: new Date()
        });

        switch(action) {
            case "📞 Agendar Call de Apresentação":
                this.scheduleCall();
                break;
            case "💬 Conversar por WhatsApp":
                this.openWhatsApp();
                break;
            case "📧 Enviar Email Detalhado":
                this.sendEmail();
                break;
            case "💰 Solicitar Proposta Formal":
                this.requestProposal();
                break;
            case "🔄 Voltar para IA":
                this.backToAI();
                break;
        }
    }

    scheduleCall() {
        this.addMessage({
            text: `📅 **Agendamento de Call**

Perfeito! Para agendar uma call de apresentação:

1. **WhatsApp:** (31) 99754-2811
2. **Email:** contato@wpwebsolucoes.com.br
3. **Horário:** Seg-Sex, 9h às 18h

**Na call vamos:**
• Entender seu projeto em detalhes
• Tirar todas as dúvidas técnicas
• Apresentar cases similares
• Discutir prazos e investimento

Pode nos contactar por qualquer canal acima! 📞`,
            isBot: true,
            timestamp: new Date()
        });
    }

    openWhatsApp() {
        this.addMessage({
            text: `📱 **WhatsApp Direto**

Clique no link abaixo para conversar diretamente pelo WhatsApp:

[👉 ABRIR WHATSAPP](https://wa.me/5531997542811?text=Olá! Gostaria de conversar sobre meu projeto.)

**No WhatsApp você pode:**
• Enviar arquivos e referências
• Marcar call rapidamente
• Receber resposta em minutos
• Falar com nosso time técnico

Estamos online agora! 🟢`,
            isBot: true,
            timestamp: new Date()
        });
    }

    sendEmail() {
        this.addMessage({
            text: `📧 **Contato por Email**

Nosso email: **contato@wpwebsolucoes.com.br**

**No email você pode incluir:**
• Descrição detalhada do projeto
• Requisitos e funcionalidades
• Prazos desejados
• Orçamento aproximado
• Anexos e referências

**Respondemos em até 4 horas úteis!** ⚡

Posso ajudar em mais alguma coisa?`,
            isBot: true,
            timestamp: new Date()
        });
    }

    requestProposal() {
        this.addMessage({
            text: `📋 **Proposta Formal**

Excelente! Para prepararmos uma proposta personalizada, preciso saber:

1. **Tipo de projeto** (app, site, sistema)
2. **Principais funcionalidades** desejadas
3. **Prazos** esperados
4. **Orçamento** aproximado (se tiver)

**Na proposta você recebe:**
• Escopo detalhado do projeto
• Cronograma faseado
• Investimento transparente
• Tecnologias a serem utilizadas
• Condições de pagamento

Pode me contar mais sobre seu projeto? 🚀`,
            isBot: true,
            timestamp: new Date()
        });
    }

    backToAI() {
        this.waitingForHuman = false;
        document.getElementById('chatAgentName').textContent = 'Assistente IA';
        document.getElementById('chatAgentStatus').textContent = 'Online • WP Web Soluções';
        
        this.addMessage({
            text: "🔄 Voltando para o modo assistente IA. Como posso ajudar você agora?",
            isBot: true,
            timestamp: new Date()
        });

        this.showQuickActions();
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.chatIA = new ChatIA();
});
