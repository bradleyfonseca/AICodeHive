import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('AICodeHive - Hello World está ativo!');

    // Registrar o comando Hello World
    const helloWorldCommand = vscode.commands.registerCommand('aicodehive.helloWorld', () => {
        HelloWorldPanel.createOrShow(context.extensionUri, context);
    });

    context.subscriptions.push(helloWorldCommand);
}

class HelloWorldPanel {
    public static currentPanel: HelloWorldPanel | undefined;
    public static readonly viewType = 'aicodehive.helloWorld';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (HelloWorldPanel.currentPanel) {
            HelloWorldPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            HelloWorldPanel.viewType,
            'AI Code Hive: Desenvolvimento Agile',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        HelloWorldPanel.currentPanel = new HelloWorldPanel(panel, extensionUri, context!);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._context = context;

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        HelloWorldPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
        
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        return;
                    case 'saveSettings':
                        this._saveSettings(message.clientId, message.clientSecret, message.slugs, message.realm);
                        webview.postMessage({ command: 'settingsSaved' });
                        return;
                    case 'loadSettings':
                        this._loadSettings(this._panel);
                        return;
                    case 'checkSettings':
                        this._checkSettings(this._panel);
                        return;
                    case 'testConnection':
                        this._testStackSpotConnection(message.clientId, message.clientSecret, this._panel);
                        return;
                    case 'generateStories':
                        vscode.window.showInformationMessage(`Gerando histórias para: ${message.featureName}`);
                        // Aqui será implementada a integração com StackSpot
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _saveSettings(clientId: string, clientSecret: string, slugs: any, realm?: string) {
        // Salvar nas configurações do VS Code (workspace e global)
        const config = vscode.workspace.getConfiguration('aiCodeHive');
        
        // Salvar Client ID, Client Secret e Realm
        config.update('stackspot.clientId', clientId, vscode.ConfigurationTarget.Global);
        config.update('stackspot.clientSecret', clientSecret, vscode.ConfigurationTarget.Global);
        if (realm !== undefined) {
            config.update('stackspot.realm', realm, vscode.ConfigurationTarget.Global);
        }
        
        // Salvar SLUGs
        if (slugs) {
            config.update('stackspot.slugs.createStories', slugs.createStories, vscode.ConfigurationTarget.Global);
            config.update('stackspot.slugs.detailBusiness', slugs.detailBusiness, vscode.ConfigurationTarget.Global);
            config.update('stackspot.slugs.detailTechnical', slugs.detailTechnical, vscode.ConfigurationTarget.Global);
            config.update('stackspot.slugs.createTests', slugs.createTests, vscode.ConfigurationTarget.Global);
            config.update('stackspot.slugs.createTasks', slugs.createTasks, vscode.ConfigurationTarget.Global);
        }
        
        // Também salvar no globalState como backup
        this._context.globalState.update('stackspot_client_id', clientId);
        this._context.globalState.update('stackspot_client_secret', clientSecret);
        if (realm !== undefined) {
            this._context.globalState.update('stackspot_realm', realm);
        }
        
        if (slugs) {
            this._context.globalState.update('stackspot_slug_create_stories', slugs.createStories);
            this._context.globalState.update('stackspot_slug_detail_business', slugs.detailBusiness);
            this._context.globalState.update('stackspot_slug_detail_technical', slugs.detailTechnical);
            this._context.globalState.update('stackspot_slug_create_tests', slugs.createTests);
            this._context.globalState.update('stackspot_slug_create_tasks', slugs.createTasks);
        }
        
        vscode.window.showInformationMessage('Configurações salvas com sucesso no VS Code!');
    }

    private async _testStackSpotConnection(clientId: string, clientSecret: string, panel: vscode.WebviewPanel) {
        try {
            // Validar se os campos estão preenchidos
            if (!clientId || !clientSecret) {
                console.log('❌ [DEBUG] Client ID ou Client Secret não fornecidos');
                panel.webview.postMessage({
                    command: 'connectionError',
                    error: 'Por favor, preencha Client ID e Client Secret'
                });
                return;
            }

            console.log('🔍 [DEBUG] Iniciando teste de conexão StackSpot');
            console.log('🔍 [DEBUG] Client ID:', clientId ? `${clientId.substring(0, 8)}...` : 'VAZIO');
            console.log('🔍 [DEBUG] Client Secret:', clientSecret ? `${clientSecret.substring(0, 8)}...` : 'VAZIO');

            // Mostrar loading
            panel.webview.postMessage({
                command: 'connectionTesting'
            });

            // Carregar realm das configurações
            const config = vscode.workspace.getConfiguration('aiCodeHive');
            const realm = config.get<string>('stackspot.realm') || 'stackspot-freemium';
            
            const tokenUrl = `https://idm.stackspot.com/${realm}/oidc/oauth/token`;
            const requestBody = new URLSearchParams({
                'client_id': clientId,
                'client_secret': clientSecret,
                'grant_type': 'client_credentials'
            });

            console.log('🔍 [DEBUG] URL do token:', tokenUrl);
            console.log('🔍 [DEBUG] Realm utilizado:', realm);
            console.log('🔍 [DEBUG] Request body:', requestBody.toString());
            console.log('🔍 [DEBUG] Headers:', {
                'Content-Type': 'application/x-www-form-urlencoded'
            });

            // Fazer requisição para obter token de acesso
            const tokenResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: requestBody
            });

            console.log('🔍 [DEBUG] Status da resposta do token:', tokenResponse.status);
            console.log('🔍 [DEBUG] Content-Type da resposta:', tokenResponse.headers.get('content-type'));

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.log('❌ [DEBUG] Erro na requisição do token:', errorText);
                console.log('❌ [DEBUG] Status completo:', tokenResponse.status, tokenResponse.statusText);
                
                panel.webview.postMessage({
                    command: 'connectionError',
                    error: `Erro na autenticação: ${tokenResponse.status} - ${tokenResponse.statusText}. Verifique suas credenciais. Detalhes: ${errorText}`
                });
                return;
            }

            const tokenData = await tokenResponse.json();
            console.log('✅ [DEBUG] Token obtido com sucesso');
            console.log('🔍 [DEBUG] Tipo do token:', tokenData.token_type);
            console.log('🔍 [DEBUG] Token (primeiros 20 chars):', tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'VAZIO');
            
            // Se conseguiu obter o token, a conexão está válida
            if (tokenData.access_token) {
                console.log('✅ [DEBUG] Conexão com StackSpot estabelecida com sucesso!');
                
                panel.webview.postMessage({
                    command: 'connectionSuccess'
                });
            } else {
                console.log('❌ [DEBUG] Token de acesso não encontrado na resposta');
                
                panel.webview.postMessage({
                    command: 'connectionError',
                    error: 'Token de acesso não encontrado na resposta'
                });
            }

        } catch (error) {
            console.log('❌ [DEBUG] Erro de exceção:', error);
            panel.webview.postMessage({
                command: 'connectionError',
                error: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
            });
        }
    }

    private _checkSettings(panel: vscode.WebviewPanel) {
        // Carregar das configurações do VS Code primeiro
        const config = vscode.workspace.getConfiguration('aiCodeHive');
        
        let clientId = config.get<string>('stackspot.clientId') || '';
        let clientSecret = config.get<string>('stackspot.clientSecret') || '';
        let realm = config.get<string>('stackspot.realm') || 'stackspot-freemium';
        
        // Se não encontrar nas configurações, tentar carregar do globalState (backup)
        if (!clientId || !clientSecret) {
            clientId = clientId || this._context.globalState.get('stackspot_client_id', '');
            clientSecret = clientSecret || this._context.globalState.get('stackspot_client_secret', '');
        }
        
        if (!realm || realm === 'stackspot-freemium') {
            realm = this._context.globalState.get('stackspot_realm', 'stackspot-freemium');
        }
        
        panel.webview.postMessage({
            command: 'settingsChecked',
            clientId: clientId,
            clientSecret: clientSecret,
            realm: realm
        });
    }

    private _loadSettings(panel: vscode.WebviewPanel) {
        // Carregar das configurações do VS Code primeiro
        const config = vscode.workspace.getConfiguration('aiCodeHive');
        
        let clientId = config.get<string>('stackspot.clientId') || '';
        let clientSecret = config.get<string>('stackspot.clientSecret') || '';
        let realm = config.get<string>('stackspot.realm') || 'stackspot-freemium';
        
        // Se não encontrar nas configurações, tentar carregar do globalState (backup)
        if (!clientId || !clientSecret) {
            clientId = clientId || this._context.globalState.get('stackspot_client_id', '');
            clientSecret = clientSecret || this._context.globalState.get('stackspot_client_secret', '');
        }
        
        if (!realm || realm === 'stackspot-freemium') {
            realm = this._context.globalState.get('stackspot_realm', 'stackspot-freemium');
        }
        
        const slugs = {
            createStories: config.get<string>('stackspot.slugs.createStories') || this._context.globalState.get('stackspot_slug_create_stories', ''),
            detailBusiness: config.get<string>('stackspot.slugs.detailBusiness') || this._context.globalState.get('stackspot_slug_detail_business', ''),
            detailTechnical: config.get<string>('stackspot.slugs.detailTechnical') || this._context.globalState.get('stackspot_slug_detail_technical', ''),
            createTests: config.get<string>('stackspot.slugs.createTests') || this._context.globalState.get('stackspot_slug_create_tests', ''),
            createTasks: config.get<string>('stackspot.slugs.createTasks') || this._context.globalState.get('stackspot_slug_create_tasks', '')
        };
        
        panel.webview.postMessage({
            command: 'settingsLoaded',
            clientId: clientId,
            clientSecret: clientSecret,
            realm: realm,
            slugs: slugs
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Code Hive: Desenvolvimento Agile</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            opacity: 0;
            transition: opacity 0.5s ease-in;
        }
        
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 800px;
            width: 95%;
        }
        
        .screen {
            display: none;
        }
        
        .screen.active {
            display: block;
        }
        
        h1 {
            font-size: 2.5rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        h2 {
            font-size: 2rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .emoji {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        
        p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        
        .button {
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            color: white;
            border: none;
            padding: 15px 30px;
            font-size: 1.1rem;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            margin: 10px;
        }
        
        .button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        
        .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }
        
        .button.secondary {
            background: linear-gradient(45deg, #74b9ff, #0984e3);
        }
        
        .button.back {
            background: linear-gradient(45deg, #6c757d, #495057);
            padding: 10px 20px;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }
        
        .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: white;
        }
        
        .form-input {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .form-input:focus {
            outline: none;
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
        }
        
        .form-input::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        .form-textarea {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 14px;
            resize: vertical;
            min-height: 120px;
            font-family: inherit;
            line-height: 1.5;
            transition: all 0.3s ease;
        }
        
        .form-textarea:focus {
            outline: none;
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
        }
        
        .form-textarea::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        .info {
            margin-top: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            font-size: 0.9rem;
            opacity: 0.8;
        }
        
        .success-message {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            border: 1px solid rgba(34, 197, 94, 0.3);
            display: none;
        }
        
        .success-message.show {
            display: block;
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification.success {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            border: 1px solid rgba(34, 197, 94, 0.3);
        }
        
        .notification.error {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
        
        .notification.info {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% {
                transform: translateY(0);
            }
            40% {
                transform: translateY(-10px);
            }
            60% {
                transform: translateY(-5px);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Tela Principal -->
        <div class="screen active" id="homeScreen">
            <div class="emoji">🚀</div>
            <h1>Desenvolvimento Agile</h1>
            <p>Bem-vindo ao AI Code Hive - sua ferramenta para desenvolvimento ágil e produtivo!</p>
            
            <button class="button" id="startButton">Vamos começar!</button>
            <button class="button secondary" id="settingsButton">Configurações</button>
            
            <div class="info">
                <strong>🎯 AI Code Hive: Desenvolvimento Agile</strong><br>
                Focado em produtividade e metodologias ágeis<br>
                <small>Versão 1.0.0</small>
            </div>
        </div>

        <!-- Tela de Configurações -->
        <div class="screen" id="settingsScreen">
            <h2>⚙️ Configurações</h2>
            
            <div class="form-group">
                <label class="form-label">Client ID (StackSpot):</label>
                <input type="text" class="form-input" placeholder="Digite seu Client ID do StackSpot" id="clientId">
            </div>
            
            <div class="form-group">
                <label class="form-label">Client Secret (StackSpot):</label>
                <input type="password" class="form-input" placeholder="Digite seu Client Secret do StackSpot" id="clientSecret">
            </div>
            
            <div class="form-group">
                <label class="form-label">Realm (StackSpot):</label>
                <input type="text" class="form-input" placeholder="stackspot-freemium" id="realm" value="stackspot-freemium">
                <small style="color: #888; font-size: 0.9em; margin-top: 5px; display: block;">Realm da aplicação StackSpot (padrão: stackspot-freemium)</small>
            </div>
            
            <h3 style="margin: 30px 0 20px 0; font-size: 1.3rem;">🔧 SLUGs das Funções</h3>
            
            <div class="form-group">
                <label class="form-label">Criar histórias de usuário:</label>
                <input type="text" class="form-input" placeholder="pm-quebra-historias" id="slugCreateStories" value="pm-quebra-historias">
            </div>
            
            <div class="form-group">
                <label class="form-label">Detalhar história (negócio):</label>
                <input type="text" class="form-input" placeholder="pm-refina-historias" id="slugDetailBusiness" value="pm-refina-historias">
            </div>
            
            <div class="form-group">
                <label class="form-label">Detalhar história (técnico):</label>
                <input type="text" class="form-input" placeholder="tcl-refina-historias" id="slugDetailTechnical" value="tcl-refina-historias">
            </div>
            
            <div class="form-group">
                <label class="form-label">Criar cenários de Testes:</label>
                <input type="text" class="form-input" placeholder="qa-cria-cenarios-testes" id="slugCreateTests" value="qa-cria-cenarios-testes">
            </div>
            
            <div class="form-group">
                <label class="form-label">Criar tarefas de desenvolvimento:</label>
                <input type="text" class="form-input" placeholder="tcl-quebra-tarefas" id="slugCreateTasks" value="tcl-quebra-tarefas">
            </div>
            
            <div class="success-message" id="settingsSuccess">✅ Configurações salvas com sucesso!</div>
            
            <button class="button" id="saveSettingsButton">💾 Salvar Configurações</button>
            <button class="button secondary" id="testConnectionButton">🔗 Testar Conexão</button>
            <button class="button back" id="backFromSettingsButton">← Voltar</button>
        </div>

        <!-- Tela de Criação de Features -->
        <div class="screen" id="featureScreen">
            <h2>✨ Nova Funcionalidade</h2>
            
            <div class="form-group">
                <label class="form-label">Nome da Funcionalidade:</label>
                <input type="text" class="form-input" placeholder="Digite o nome da funcionalidade" id="featureName">
            </div>
            
            <div class="form-group">
                <label class="form-label">Descrição da Funcionalidade:</label>
                <textarea class="form-textarea" placeholder="Descreva detalhadamente a funcionalidade desejada, incluindo requisitos, regras de negócio e comportamentos esperados..." id="featureDescription"></textarea>
            </div>
            
            <button class="button" id="generateButton">📝 Gerar Histórias de Usuário</button>
            <button class="button back" id="backFromFeatureButton">← Voltar</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Sistema de notificações
        function showNotification(message, type = 'info') {
            // Remove notificação existente se houver
            const existingNotification = document.querySelector('.notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            // Cria nova notificação
            const notification = document.createElement('div');
            notification.className = 'notification ' + type;
            notification.textContent = message;
            
            // Adiciona ao body
            document.body.appendChild(notification);
            
            // Mostra a notificação
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            
            // Remove após 4 segundos
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 4000);
        }
        
        // Navegação entre telas
        function showScreen(screenId) {
            document.querySelectorAll('.screen').forEach(screen => {
                screen.classList.remove('active');
            });
            document.getElementById(screenId).classList.add('active');
        }
        
        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {
            // Função para verificar e atualizar o estado do botão "Vamos começar"
            function updateStartButtonState() {
                const startButton = document.getElementById('startButton');
                // Verificar se há configurações salvas
                vscode.postMessage({ command: 'checkSettings' });
            }
            
            // Botões da tela principal
            document.getElementById('startButton').addEventListener('click', function() {
                showScreen('featureScreen');
            });
            
            document.getElementById('settingsButton').addEventListener('click', function() {
                showScreen('settingsScreen');
                // Carregar configurações salvas
                vscode.postMessage({ command: 'loadSettings' });
            });
            
            // Botões da tela de configurações
            document.getElementById('saveSettingsButton').addEventListener('click', function() {
                const clientId = document.getElementById('clientId').value.trim();
                const clientSecret = document.getElementById('clientSecret').value.trim();
                const realm = document.getElementById('realm').value.trim() || 'stackspot-freemium';
                
                if (!clientId || !clientSecret) {
                    showNotification('Por favor, preencha Client ID e Client Secret', 'error');
                    return;
                }
                
                const slugs = {
                    createStories: document.getElementById('slugCreateStories').value.trim(),
                    detailBusiness: document.getElementById('slugDetailBusiness').value.trim(),
                    detailTechnical: document.getElementById('slugDetailTechnical').value.trim(),
                    createTests: document.getElementById('slugCreateTests').value.trim(),
                    createTasks: document.getElementById('slugCreateTasks').value.trim()
                };
                
                vscode.postMessage({
                    command: 'saveSettings',
                    clientId: clientId,
                    clientSecret: clientSecret,
                    realm: realm,
                    slugs: slugs
                });
            });
            
            document.getElementById('testConnectionButton').addEventListener('click', function() {
                const clientId = document.getElementById('clientId').value.trim();
                const clientSecret = document.getElementById('clientSecret').value.trim();
                
                if (!clientId || !clientSecret) {
                    showNotification('Por favor, preencha Client ID e Client Secret antes de testar a conexão', 'error');
                    return;
                }
                
                vscode.postMessage({
                    command: 'testConnection',
                    clientId: clientId,
                    clientSecret: clientSecret
                });
            });
            
            document.getElementById('backFromSettingsButton').addEventListener('click', function() {
                showScreen('homeScreen');
            });
            
            // Botões da tela de features
            document.getElementById('generateButton').addEventListener('click', function() {
                const featureName = document.getElementById('featureName').value.trim();
                const featureDescription = document.getElementById('featureDescription').value.trim();
                
                if (!featureName || !featureDescription) {
                    showNotification('Por favor, preencha o nome e a descrição da funcionalidade', 'error');
                    return;
                }
                
                vscode.postMessage({
                    command: 'generateStories',
                    featureName: featureName,
                    featureDescription: featureDescription
                });
            });
            
            document.getElementById('backFromFeatureButton').addEventListener('click', function() {
                showScreen('homeScreen');
            });
            
            // Animação de entrada
            document.body.style.opacity = '1';
            
            // Verificar estado inicial do botão
            updateStartButtonState();
        });
        
        // Listener para mensagens do VS Code
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'settingsLoaded':
                    if (message.clientId) {
                        document.getElementById('clientId').value = message.clientId;
                    }
                    if (message.clientSecret) {
                        document.getElementById('clientSecret').value = message.clientSecret;
                    }
                    if (message.realm) {
                        document.getElementById('realm').value = message.realm;
                    }
                    if (message.slugs) {
                        document.getElementById('slugCreateStories').value = message.slugs.createStories || 'pm-quebra-historias';
                        document.getElementById('slugDetailBusiness').value = message.slugs.detailBusiness || 'pm-refina-historias';
                        document.getElementById('slugDetailTechnical').value = message.slugs.detailTechnical || 'tcl-refina-historias';
                        document.getElementById('slugCreateTests').value = message.slugs.createTests || 'qa-cria-cenarios-testes';
                        document.getElementById('slugCreateTasks').value = message.slugs.createTasks || 'tcl-quebra-tarefas';
                    }
                    break;
                case 'settingsChecked':
                    const startButton = document.getElementById('startButton');
                    const hasValidSettings = message.clientId && message.clientSecret;
                    startButton.disabled = !hasValidSettings;
                    if (!hasValidSettings) {
                        startButton.title = 'Configure Client ID e Client Secret nas configurações antes de começar';
                    } else {
                        startButton.title = '';
                    }
                    break;
                case 'settingsSaved':
                    const successMsg = document.getElementById('settingsSuccess');
                    successMsg.classList.add('show');
                    setTimeout(() => {
                        successMsg.classList.remove('show');
                    }, 3000);
                    // Atualizar estado do botão após salvar configurações
                    updateStartButtonState();
                    break;
                case 'connectionTesting':
                    showNotification('🔄 Testando conexão com StackSpot...', 'info');
                    break;
                case 'connectionSuccess':
                    showNotification('✅ Conexão com StackSpot realizada com sucesso!', 'success');
                    break;
                case 'connectionError':
                    showNotification('❌ Erro ao conectar com StackSpot: ' + message.error, 'error');
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}

export function deactivate() {}