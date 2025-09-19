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
                        this._generateUserStories(message.featureName, message.featureDescription);
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

    /**
     * Gera histórias de usuário usando o StackSpot
     * @param featureName - Nome da funcionalidade
     * @param featureDescription - Descrição detalhada da funcionalidade
     */
    private async _generateUserStories(featureName: string, featureDescription: string) {
        console.log(`[StackSpot] 🎯 Iniciando geração de histórias de usuário para: ${featureName}`);
        
        try {
            // Carrega as configurações para obter o SLUG
            const config = await this.loadConfig();
            const createStoriesSlug = config.stackspot?.slugs?.createStories;
            
            if (!createStoriesSlug) {
                const errorMsg = 'SLUG para "Criar histórias de usuário" não configurado. Verifique as configurações.';
                console.error(`[StackSpot] ❌ ${errorMsg}`);
                this._panel.webview.postMessage({
                command: 'userStoriesError',
                error: errorMsg
            });
                return;
            }
            
            console.log(`[StackSpot] 📋 Usando SLUG: ${createStoriesSlug}`);
            
            // Notifica o início da geração
            this._panel.webview.postMessage({
                command: 'userStoriesGenerating',
                featureName: featureName
            });
            
            // Prepara o payload com a descrição da funcionalidade
            const payload = {
                feature_name: featureName,
                feature_description: featureDescription
            };
            
            console.log(`[StackSpot] 📝 Payload preparado: ${JSON.stringify(payload, null, 2)}`);
            
            // Executa o quick-command (sem conversation_id conforme solicitado)
            const result = await this.executeQuickCommand(createStoriesSlug, payload);
            
            console.log(`[StackSpot] ✅ Histórias de usuário geradas com sucesso!`);
            
            // Envia o resultado para a interface
            this._panel.webview.postMessage({
                command: 'userStoriesGenerated',
                result: result,
                featureName: featureName
            });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[StackSpot] 💥 Erro ao gerar histórias de usuário:`, error);
            
            this._panel.webview.postMessage({
                command: 'userStoriesError',
                error: errorMessage,
                featureName: featureName
            });
        }
    }

    /**
     * Carrega as configurações do StackSpot
     * @returns Configurações completas
     */
    private async loadConfig() {
        const config = vscode.workspace.getConfiguration('aiCodeHive');
        
        return {
            stackspot: {
                clientId: config.get<string>('stackspot.clientId') || this._context.globalState.get('stackspot_client_id', ''),
                clientSecret: config.get<string>('stackspot.clientSecret') || this._context.globalState.get('stackspot_client_secret', ''),
                realm: config.get<string>('stackspot.realm') || this._context.globalState.get('stackspot_realm', 'stackspot-freemium'),
                slugs: {
                    createStories: config.get<string>('stackspot.slugs.createStories') || this._context.globalState.get('stackspot_slug_create_stories', ''),
                    detailBusiness: config.get<string>('stackspot.slugs.detailBusiness') || this._context.globalState.get('stackspot_slug_detail_business', ''),
                    detailTechnical: config.get<string>('stackspot.slugs.detailTechnical') || this._context.globalState.get('stackspot_slug_detail_technical', ''),
                    createTests: config.get<string>('stackspot.slugs.createTests') || this._context.globalState.get('stackspot_slug_create_tests', ''),
                    createTasks: config.get<string>('stackspot.slugs.createTasks') || this._context.globalState.get('stackspot_slug_create_tasks', '')
                }
            }
        };
    }

    private _loadSettings(panel: vscode.WebviewPanel) {
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

    /**
     * Cria uma execução de quick-command no StackSpot
     * @param slug - SLUG do quick-command a ser executado
     * @param payload - Dados de entrada para o quick-command
     * @param accessToken - Token de acesso para autenticação
     * @param conversationId - ID da conversa (opcional)
     * @returns Promise<string> - ID da execução criada
     */
    private async _createQuickCommandExecution(slug: string, payload: any, accessToken: string, conversationId?: string): Promise<string> {
        const startTime = Date.now();
        console.log(`[StackSpot] 🚀 Iniciando criação de execução para quick-command: ${slug}`);
        console.log(`[StackSpot] 📝 Payload: ${JSON.stringify(payload, null, 2)}`);
        
        if (conversationId) {
            console.log(`[StackSpot] 💬 Conversation ID: ${conversationId}`);
        }

        try {
            const headers: any = {
                'Authorization': `Bearer ${accessToken.substring(0, 10)}...`,
                'Content-Type': 'application/json'
            };

            // Adiciona o header conversation_id apenas se fornecido
            if (conversationId) {
                headers['conversation_id'] = conversationId;
                console.log(`[StackSpot] ➕ Adicionando header conversation_id: ${conversationId}`);
            }

            const url = `https://genai-code-buddy-api.stackspot.com/v1/quick-commands/create-execution/${slug}`;
            console.log(`[StackSpot] 🌐 URL da requisição: ${url}`);
            console.log(`[StackSpot] 📤 Enviando requisição POST...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    ...(conversationId && { 'conversation_id': conversationId })
                },
                body: JSON.stringify({
                    input_data: payload
                })
            });

            const duration = Date.now() - startTime;
            console.log(`[StackSpot] ⏱️ Tempo de resposta: ${duration}ms`);
            console.log(`[StackSpot] 📊 Status da resposta: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[StackSpot] ❌ Erro na criação da execução: ${response.status} - ${response.statusText}`);
                console.error(`[StackSpot] 📄 Detalhes do erro: ${errorText}`);
                throw new Error(`Erro na criação da execução: ${response.status} - ${response.statusText}. Detalhes: ${errorText}`);
            }

            const executionId = await response.text();
            const cleanExecutionId = executionId.trim().replace(/^["']|["']$/g, '');
            
            console.log(`[StackSpot] ✅ Execução criada com sucesso!`);
            console.log(`[StackSpot] 🆔 Execution ID: ${cleanExecutionId}`);
            console.log(`[StackSpot] ⏱️ Tempo total: ${duration}ms`);
            
            return cleanExecutionId;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[StackSpot] 💥 Erro ao criar execução após ${duration}ms:`, error);
            console.error(`[StackSpot] 🔍 Slug: ${slug}`);
            console.error(`[StackSpot] 📝 Payload: ${JSON.stringify(payload)}`);
            throw error;
        }
    }

    /**
     * Faz callback para obter o resultado de uma execução de quick-command
     * @param executionId - ID da execução a ser consultada
     * @param accessToken - Token de acesso para autenticação
     * @returns Promise<any> - Resposta da execução
     */
    private async _getQuickCommandCallback(executionId: string, accessToken: string): Promise<any> {
        const startTime = Date.now();
        console.log(`[StackSpot] 🔄 Consultando status da execução: ${executionId}`);

        try {
            const url = `https://genai-code-buddy-api.stackspot.com/v1/quick-commands/callback/${executionId}`;
            console.log(`[StackSpot] 🌐 URL da consulta: ${url}`);
            console.log(`[StackSpot] 📤 Enviando requisição GET...`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const duration = Date.now() - startTime;
            console.log(`[StackSpot] ⏱️ Tempo de resposta: ${duration}ms`);
            console.log(`[StackSpot] 📊 Status da resposta: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[StackSpot] ❌ Erro na consulta da execução: ${response.status} - ${response.statusText}`);
                console.error(`[StackSpot] 📄 Detalhes do erro: ${errorText}`);
                throw new Error(`Erro na consulta da execução: ${response.status} - ${response.statusText}. Detalhes: ${errorText}`);
            }

            const result = await response.json();
            console.log(`[StackSpot] 📋 Status atual: ${result.progress?.status || 'N/A'}`);
            
            if (result.progress?.status) {
                const status = result.progress.status;
                const statusEmoji = status === 'COMPLETED' ? '✅' : 
                                  status === 'FAILED' ? '❌' : 
                                  status === 'ERROR' ? '💥' : 
                                  status === 'RUNNING' ? '🔄' : '⏳';
                console.log(`[StackSpot] ${statusEmoji} Status da execução: ${status}`);
                
                if (result.progress.execution_percentage !== undefined) {
                    console.log(`[StackSpot] 📊 Progresso: ${result.progress.execution_percentage}%`);
                }
            }

            console.log(`[StackSpot] ⏱️ Tempo total da consulta: ${duration}ms`);
            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[StackSpot] 💥 Erro ao consultar execução após ${duration}ms:`, error);
            console.error(`[StackSpot] 🆔 Execution ID: ${executionId}`);
            throw error;
        }
    }

    /**
     * Aguarda a conclusão de uma execução fazendo polling a cada 5 segundos
     * @param executionId - ID da execução a ser monitorada
     * @param accessToken - Token de acesso para autenticação
     * @param maxAttempts - Número máximo de tentativas (padrão: 60 = 5 minutos)
     * @returns Promise<any> - Resultado final da execução
     */
    private async _waitForExecutionCompletion(executionId: string, accessToken: string, maxAttempts: number = 60): Promise<any> {
        const startTime = Date.now();
        console.log(`[StackSpot] ⏳ Iniciando monitoramento da execução: ${executionId}`);
        console.log(`[StackSpot] 🔄 Máximo de tentativas: ${maxAttempts} (${maxAttempts * 5} segundos)`);
        
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            const attemptStartTime = Date.now();
            
            console.log(`[StackSpot] 🔍 Tentativa ${attempts}/${maxAttempts} - Verificando status...`);
            
            try {
                const result = await this._getQuickCommandCallback(executionId, accessToken);
                const status = result.progress?.status;
                
                if (status === 'COMPLETED') {
                    const totalDuration = Date.now() - startTime;
                    console.log(`[StackSpot] 🎉 Execução concluída com sucesso!`);
                    console.log(`[StackSpot] ⏱️ Tempo total de execução: ${Math.round(totalDuration / 1000)}s`);
                    console.log(`[StackSpot] 🔢 Total de tentativas: ${attempts}`);
                    
                    if (result.result) {
                        console.log(`[StackSpot] 📄 Resultado disponível (${JSON.stringify(result.result).length} caracteres)`);
                    }
                    
                    return result;
                }
                
                if (status === 'FAILED' || status === 'ERROR') {
                    const totalDuration = Date.now() - startTime;
                    console.error(`[StackSpot] ❌ Execução falhou com status: ${status}`);
                    console.error(`[StackSpot] ⏱️ Tempo até falha: ${Math.round(totalDuration / 1000)}s`);
                    console.error(`[StackSpot] 🔢 Tentativas até falha: ${attempts}`);
                    
                    if (result.result) {
                        console.error(`[StackSpot] 📄 Detalhes do erro: ${JSON.stringify(result.result, null, 2)}`);
                    }
                    
                    throw new Error(`Execução falhou com status: ${status}. Resultado: ${JSON.stringify(result.result)}`);
                }
                
                // Status ainda em andamento (RUNNING, PENDING, etc.)
                const remainingAttempts = maxAttempts - attempts;
                const estimatedTimeLeft = remainingAttempts * 5;
                console.log(`[StackSpot] ⏳ Status: ${status} - Aguardando 5s... (${remainingAttempts} tentativas restantes, ~${estimatedTimeLeft}s)`);
                
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
            } catch (error) {
                const attemptDuration = Date.now() - attemptStartTime;
                console.error(`[StackSpot] ⚠️ Erro na tentativa ${attempts} após ${attemptDuration}ms:`, error);
                
                // Se não é o último attempt, continua tentando
                if (attempts < maxAttempts) {
                    console.log(`[StackSpot] 🔄 Continuando... (${maxAttempts - attempts} tentativas restantes)`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    // Se é o último attempt, relança o erro
                    const totalDuration = Date.now() - startTime;
                    console.error(`[StackSpot] 💥 Falha definitiva após ${attempts} tentativas e ${Math.round(totalDuration / 1000)}s`);
                    throw error;
                }
            }
        }
        
        // Timeout atingido
        const totalDuration = Date.now() - startTime;
        console.error(`[StackSpot] ⏰ Timeout atingido após ${attempts} tentativas e ${Math.round(totalDuration / 1000)}s`);
        console.error(`[StackSpot] 🆔 Execution ID: ${executionId}`);
        throw new Error(`Timeout: Execução não foi concluída após ${maxAttempts} tentativas (${maxAttempts * 5} segundos)`);
    }

    /**
     * Executa um quick-command no StackSpot de forma completa (criação + polling até conclusão)
     * @param slug - SLUG do quick-command a ser executado
     * @param payload - Dados de entrada para o quick-command
     * @param conversationId - ID da conversa (opcional)
     * @param maxWaitMinutes - Tempo máximo de espera em minutos (padrão: 5)
     * @returns Promise<any> - Resultado final da execução
     */
    public async executeQuickCommand(slug: string, payload: any, conversationId?: string, maxWaitMinutes: number = 5): Promise<any> {
        const startTime = Date.now();
        const maxAttempts = maxWaitMinutes * 12; // 12 tentativas por minuto (5s cada)
        
        console.log(`[StackSpot] 🚀 ========== INICIANDO EXECUÇÃO DE QUICK-COMMAND ==========`);
        console.log(`[StackSpot] 📋 Slug: ${slug}`);
        console.log(`[StackSpot] 📝 Payload: ${JSON.stringify(payload, null, 2)}`);
        console.log(`[StackSpot] 💬 Conversation ID: ${conversationId || 'N/A'}`);
        console.log(`[StackSpot] ⏰ Timeout máximo: ${maxWaitMinutes} minutos (${maxAttempts} tentativas)`);
        console.log(`[StackSpot] ===============================================================`);

        try {
            // 1. Carrega as configurações
            console.log(`[StackSpot] 📂 Etapa 1/4: Carregando configurações...`);
            const config = vscode.workspace.getConfiguration('aiCodeHive');
            const clientId = config.get<string>('stackspot.clientId') || this._context.globalState.get<string>('stackspot_client_id');
            const clientSecret = config.get<string>('stackspot.clientSecret') || this._context.globalState.get<string>('stackspot_client_secret');
            const realm = config.get<string>('stackspot.realm') || this._context.globalState.get<string>('stackspot_realm') || 'stackspot-freemium';

            if (!clientId || !clientSecret) {
                console.error(`[StackSpot] ❌ Configurações do StackSpot não encontradas`);
                console.error(`[StackSpot] 🔧 Client ID: ${clientId ? 'Configurado' : 'Não configurado'}`);
                console.error(`[StackSpot] 🔧 Client Secret: ${clientSecret ? 'Configurado' : 'Não configurado'}`);
                throw new Error('Client ID e Client Secret são obrigatórios. Configure-os nas configurações da extensão.');
            }
            
            console.log(`[StackSpot] ✅ Configurações carregadas com sucesso`);
            console.log(`[StackSpot] 🔧 Client ID: ${clientId.substring(0, 8)}...`);

            // 2. Obtém o token de acesso
            console.log(`[StackSpot] 🔑 Etapa 2/4: Obtendo token de acesso...`);
            const tokenUrl = `https://idm.stackspot.com/${realm}/oidc/oauth/token`;
            const tokenResponse = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`
            });

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error(`[StackSpot] ❌ Erro ao obter token: ${tokenResponse.status} - ${tokenResponse.statusText}`);
                console.error(`[StackSpot] 📄 Detalhes: ${errorText}`);
                throw new Error(`Erro ao obter token: ${tokenResponse.status} - ${tokenResponse.statusText}`);
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            if (!accessToken) {
                console.error(`[StackSpot] ❌ Token de acesso não foi retornado pela API`);
                throw new Error('Token de acesso não foi retornado pela API');
            }

            console.log(`[StackSpot] ✅ Token obtido com sucesso (${accessToken.substring(0, 20)}...)`);

            // 3. Cria a execução do quick-command
            console.log(`[StackSpot] 🎯 Etapa 3/4: Criando execução do quick-command...`);
            const executionId = await this._createQuickCommandExecution(slug, payload, accessToken, conversationId);
            console.log(`[StackSpot] ✅ Execução criada: ${executionId}`);
            
            // 4. Aguarda a conclusão da execução
            console.log(`[StackSpot] ⏳ Etapa 4/4: Aguardando conclusão da execução...`);
            const result = await this._waitForExecutionCompletion(executionId, accessToken, maxAttempts);
            
            const totalDuration = Date.now() - startTime;
            console.log(`[StackSpot] 🎉 ========== EXECUÇÃO CONCLUÍDA COM SUCESSO ==========`);
            console.log(`[StackSpot] 🆔 Execution ID: ${executionId}`);
            console.log(`[StackSpot] ⏱️ Tempo total: ${Math.round(totalDuration / 1000)}s`);
            console.log(`[StackSpot] 📄 Tamanho do resultado: ${JSON.stringify(result).length} caracteres`);
            console.log(`[StackSpot] =====================================================`);

            return result;

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[StackSpot] 💥 ========== ERRO NA EXECUÇÃO ==========`);
            console.error(`[StackSpot] 📋 Slug: ${slug}`);
            console.error(`[StackSpot] ⏱️ Tempo até erro: ${Math.round(totalDuration / 1000)}s`);
            console.error(`[StackSpot] 💬 Conversation ID: ${conversationId || 'N/A'}`);
            console.error(`[StackSpot] ❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
            console.error(`[StackSpot] 📝 Payload: ${JSON.stringify(payload)}`);
            console.error(`[StackSpot] ==========================================`);
            
            throw error;
        }
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

        <!-- Tela de Resultado -->
        <div class="screen" id="resultScreen">
            <h2>📋 Resultado da Geração</h2>
            <div id="resultContent" style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px; text-align: left; max-height: 400px; overflow-y: auto; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4;"></div>
            <button class="button back" id="backFromResultButton">← Voltar</button>
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

            document.getElementById('backFromResultButton').addEventListener('click', function() {
                showScreen('featureScreen');
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
                case 'userStoriesGenerating':
                    showNotification('🔄 Gerando histórias de usuário...', 'info');
                    break;
                case 'userStoriesGenerated':
                    showScreen('resultScreen');
                    document.getElementById('resultContent').innerHTML = '<pre>' + JSON.stringify(message.result, null, 2) + '</pre>';
                    break;
                case 'userStoriesError':
                    showNotification('❌ Erro ao gerar histórias de usuário: ' + message.error, 'error');
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}

export function deactivate() {}