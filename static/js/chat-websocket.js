// WebSocket Implementation for Human Chat
class ChatWebSocket {
    constructor(chatIAInstance) {
        this.chatIA = chatIAInstance;
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        try {
            // Substitua pela URL do seu servidor WebSocket
            const wsUrl = 'wss://seu-servidor.com/chat';
            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('WebSocket conectado');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnected();
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.socket.onclose = () => {
                console.log('WebSocket desconectado');
                this.isConnected = false;
                this.handleDisconnection();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
            this.fallbackToSimulation();
        }
    }

    onConnected() {
        // Envia informações do usuário para o atendente
        this.send({
            type: 'user_join',
            userData: this.getUserData(),
            conversationHistory: this.chatIA.conversationContext
        });
    }

    handleMessage(data) {
        switch(data.type) {
            case 'welcome':
                this.chatIA.addMessage({
                    text: data.message,
                    isBot: true,
                    timestamp: new Date()
                });
                break;

            case 'agent_message':
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
        }
    }

    sendMessage(message) {
        if (this.isConnected && this.socket) {
            this.send({
                type: 'user_message',
                message: message,
                timestamp: new Date().toISOString()
            });
        } else {
            // Fallback para simulação se WebSocket não estiver disponível
            this.simulateAgentResponse(message);
        }
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    handleDisconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 3000 * this.reconnectAttempts);
        } else {
            this.fallbackToSimulation();
        }
    }

    fallbackToSimulation() {
        console.log('Usando modo simulação para atendimento');
        // O chat IA já tem fallback integrado
    }

    simulateAgentResponse(userMessage) {
        setTimeout(() => {
            const responses = [
                "Entendi sua mensagem! Pode me contar um pouco mais sobre seu projeto?",
                "Excelente pergunta! Para te dar a melhor orientação, qual é o objetivo principal do seu projeto?",
                "Perfeito! Estou analisando sua solicitação. Você tem algum prazo específico em mente?",
                "Obrigado pelas informações! Posso preparar uma proposta preliminar baseada no que você me contou.",
                "Entendi seu需求! Nossos especialistas já estão analisando o caso. Posso conectar você diretamente com nosso time técnico?"
            ];
            
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            this.chatIA.addMessage({
                text: randomResponse,
                isBot: true,
                timestamp: new Date()
            });
        }, 2000);
    }

    handleTransferStatus(data) {
        if (data.status === 'connected') {
            this.chatIA.hideTransferIndicator();
            this.chatIA.addMessage({
                text: `👋 Olá! Sou ${data.agentName}, ${data.agentRole} da WP Web Soluções.

Em que posso ajudar você hoje?`,
                isBot: true,
                timestamp: new Date()
            });
        } else if (data.status === 'waiting') {
            this.chatIA.addMessage({
                text: `⏳ Nossos atendentes estão ocupados no momento. Você é o ${data.position}º na fila. Tempo estimado: ${data.waitTime} minutos.`,
                isBot: true,
                timestamp: new Date()
            });
        }
    }

    getUserData() {
        // Coleta informações básicas do usuário (respeitando privacidade)
        return {
            page: window.location.href,
            userAgent: navigator.userAgent,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer: document.referrer
        };
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Integração com o ChatIA
document.addEventListener('DOMContentLoaded', function() {
    // Quando o usuário solicitar atendimento humano, inicializa WebSocket
    // Isso seria chamado no método transferToHuman() do ChatIA
    window.chatWebSocket = new ChatWebSocket(window.chatIA);
});