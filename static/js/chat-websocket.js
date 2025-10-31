// WebSocket Implementation for Human Chat - VERSÃO ATUALIZADA
class ChatWebSocket {
    constructor(chatIAInstance) {
        this.chatIA = chatIAInstance;
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        return 'guest_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    connect() {
        try {
            // Use a URL do seu servidor - ajuste conforme necessário
            const wsUrl = 'ws://localhost:8000/ws/chat';
            // Para produção: 'wss://seuservidor.com/ws/chat'
            
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('✅ WebSocket conectado para atendimento humano');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnected();
            };

            this.socket.onmessage = (event) => {
                console.log('📨 Mensagem recebida:', event.data);
                this.handleMessage(JSON.parse(event.data));
            };

            this.socket.onclose = (event) => {
                console.log('❌ WebSocket desconectado:', event.code, event.reason);
                this.isConnected = false;
                this.handleDisconnection();
            };

            this.socket.onerror = (error) => {
                console.error('💥 WebSocket error:', error);
                this.chatIA.addMessage({
                    text: "⚠️ Problema de conexão. Tentando reconectar...",
                    isBot: true,
                    timestamp: new Date()
                });
            };

        } catch (error) {
            console.error('❌ Erro ao conectar WebSocket:', error);
            this.fallbackToSimulation();
        }
    }

    onConnected() {
        // Envia informações do usuário para o atendente
        this.send({
            type: 'user_join',
            userData: this.getUserData(),
            conversationHistory: this.chatIA.conversationContext,
            sessionId: this.sessionId
        });
        
        this.chatIA.addMessage({
            text: "✅ Conectado! Procurando atendente disponível...",
            isBot: true,
            timestamp: new Date()
        });
    }

    handleMessage(data) {
        console.log('🔄 Processando mensagem:', data);
        
        switch(data.type) {
            case 'welcome':
                this.chatIA.addMessage({
                    text: data.message,
                    isBot: true,
                    timestamp: new Date()
                });
                break;

            case 'agent_message':
                this.chatIA.hideTypingIndicator();
                this.chatIA.addMessage({
                    text: data.message,
                    isBot: true,
                    timestamp: new Date()
                });
                break;

            case 'agent_typing':
                if (data.typing) {
                    this.chatIA.showTypingIndicator();
                } else {
                    this.chatIA.hideTypingIndicator();
                }
                break;

            case 'transfer_status':
                this.handleTransferStatus(data);
                break;
                
            case 'agent_left':
                this.handleAgentDisconnection(data.message);
                break;
                
            case 'guest_left':
                // Mensagem para o agente - não precisa tratar aqui
                break;

            default:
                console.log('📝 Tipo de mensagem não tratado:', data.type);
        }
    }

    handleTransferStatus(data) {
        console.log('🔄 Status de transferência:', data);
        
        if (data.status === 'connected') {
            this.chatIA.hideTransferIndicator();
            this.chatIA.waitingForHuman = false;
            
            // Atualiza interface para modo humano
            document.getElementById('chatAgentName').textContent = data.agentName || 'Atendente';
            document.getElementById('chatAgentStatus').textContent = 'Online • Em atendimento';
            
            this.chatIA.addMessage({
                text: `👋 Olá! Sou ${data.agentName}, ${data.agentRole} da WP Web Soluções.\n\nEm que posso ajudar você hoje?`,
                isBot: true,
                timestamp: new Date()
            });
            
            // Mostra ações específicas para atendimento humano
            this.showHumanQuickActions();
            
        } else if (data.status === 'waiting') {
            this.chatIA.addMessage({
                text: `⏳ **Você está na fila de atendimento**\n\nPosição: ${data.position}º\nTempo estimado: ${data.waitTime} minutos\n\nEnquanto isso, pode me contar mais sobre seu projeto!`,
                isBot: true,
                timestamp: new Date()
            });
        }
    }

    handleAgentDisconnection(message) {
        this.chatIA.addMessage({
            text: `🔴 ${message}\n\nRetornando para o modo assistente IA...`,
            isBot: true,
            timestamp: new Date()
        });
        
        // Reseta para modo IA
        this.resetToAIMode();
    }

    resetToAIMode() {
        this.chatIA.waitingForHuman = false;
        this.chatIA.hideTransferIndicator();
        
        document.getElementById('chatAgentName').textContent = 'Assistente IA';
        document.getElementById('chatAgentStatus').textContent = 'Online • WP Web Soluções';
        
        this.chatIA.addMessage({
            text: "🔄 Estou de volta! Como posso ajudar você agora?",
            isBot: true,
            timestamp: new Date()
        });

        this.chatIA.showQuickActions();
        this.disconnect();
    }

    sendMessage(message) {
        if (this.isConnected && this.socket) {
            this.send({
                type: 'user_message',
                message: message,
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId
            });
            
            // Mostra indicador de digitação do agente
            this.chatIA.showTypingIndicator();
            
        } else {
            console.warn('⚠️ WebSocket não conectado, usando fallback');
            this.fallbackToSimulation(message);
        }
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
            console.log('📤 Mensagem enviada:', data);
        } else {
            console.error('❌ WebSocket não está aberto. Estado:', this.socket?.readyState);
        }
    }

    handleDisconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = 3000 * this.reconnectAttempts;
            
            this.chatIA.addMessage({
                text: `🔌 Conexão perdida. Tentando reconectar em ${delay/1000} segundos... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
                isBot: true,
                timestamp: new Date()
            });
            
            setTimeout(() => this.connect(), delay);
        } else {
            this.fallbackToSimulation();
        }
    }

    fallbackToSimulation(userMessage = null) {
        console.log('🔄 Ativando modo simulação');
        
        this.chatIA.addMessage({
            text: "🔧 **Modo Offline Ativado**\n\nNossos atendentes estão temporariamente indisponíveis. Estou aqui para ajudar!\n\nEnquanto isso, você pode:\n• 📧 Email: contato@wpwebsolucoes.com.br\n• 📱 WhatsApp: (31) 99754-2811",
            isBot: true,
            timestamp: new Date()
        });
        
        if (userMessage) {
            // Simula resposta do agente após algum tempo
            setTimeout(() => {
                this.simulateAgentResponse(userMessage);
            }, 2000);
        }
        
        this.chatIA.showQuickActions();
    }

    simulateAgentResponse(userMessage) {
        const responses = [
            `Obrigado pela sua mensagem: "${userMessage.substring(0, 50)}..."\n\nNo momento nossos atendentes estão offline, mas assim que retornarem entraremos em contato!`,
            "Recebi sua solicitação! Enquanto aguarda um atendente humano, posso ajudar com orçamentos, prazos e informações técnicas.",
            "Sua mensagem foi registrada! Nossa equipe entrará em contato em breve. Posso auxiliar com alguma informação específica sobre nossos serviços?"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        this.chatIA.addMessage({
            text: randomResponse,
            isBot: true,
            timestamp: new Date()
        });
    }

    getUserData() {
        // 1. Puxa os dados do formulário que o ChatIA nos deu
        //    (this.clientData é preenchido pelo ChatIA.initializeWebSocket)
        const formData = this.clientData || {};

        // 2. Monta o payload final
        return {
            // Dados do formulário
            sessionId: this.sessionId,
            name: formData.name || `Cliente ${this.sessionId.substring(0, 8)}`,
            email: formData.email || null,
            phone: formData.phone || null,
            project: formData.project || null,
            urgency: formData.urgency || null,
            message: formData.message || null, // A msg do formulário
            
            // Dados de rastreamento (Buscando do formData primeiro)
            source: formData.source || document.referrer || 'Direct',
            page: formData.page || window.location.href,
            timeOnPage: formData.timeOnPage || '0 segundos',
            
            // Dados técnicos
            userAgent: navigator.userAgent.substring(0, 100),
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            screen: `${screen.width}x${screen.height}`,
            timestamp: formData.timestamp || new Date().toISOString()
        };
    }

    showHumanQuickActions() {
        const humanActions = [
            "📞 Agendar Call de Apresentação",
            "💬 Continuar Chat", 
            "📧 Receber Proposta por Email",
            "💰 Solicitar Orçamento Detalhado",
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
            button.addEventListener('click', (e) => {
                const action = button.getAttribute('data-action');
                this.handleHumanAction(action);
                e.stopPropagation();
            });
        });
    }

    handleHumanAction(action) {
        document.querySelector('.quick-actions')?.remove();
        
        // Envia a ação como mensagem
        this.sendMessage(action);
        
        switch(action) {
            case "📞 Agendar Call de Apresentação":
                this.chatIA.addMessage({
                    text: "📅 **Solicitando Agendamento**\n\nUm atendente entrará em contato para agendar a call!",
                    isBot: true,
                    timestamp: new Date()
                });
                break;
            case "🔄 Voltar para IA":
                this.resetToAIMode();
                break;
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'Normal closure');
            this.socket = null;
        }
        this.isConnected = false;
    }
}

// Integração automática com o ChatIA
document.addEventListener('DOMContentLoaded', function() {
    // Não inicializa automaticamente, só quando solicitado
    console.log('✅ ChatWebSocket carregado e pronto');
});