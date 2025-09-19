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
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, context?: vscode.ExtensionContext) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Se já existe um painel, apenas o mostra
        if (HelloWorldPanel.currentPanel) {
            HelloWorldPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Caso contrário, cria um novo painel
        const panel = vscode.window.createWebviewPanel(
            HelloWorldPanel.viewType,
            'AICodeHive - Hello World',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        HelloWorldPanel.currentPanel = new HelloWorldPanel(panel, extensionUri);

        // Adicionar listener para mensagens do webview
        if (context) {
            panel.webview.onDidReceiveMessage(
                async (message) => {
                    switch (message.command) {
                        case 'saveCredentials':
                            // Armazenar credenciais e token no estado global
                            await context.globalState.update('stackspot_client_id', message.clientId);
                            await context.globalState.update('stackspot_client_secret', message.clientSecret);
                            await context.globalState.update('stackspot_access_token', message.accessToken);
                            await context.globalState.update('stackspot_token_expires', Date.now() + (message.expiresIn * 1000));
                            
                            vscode.window.showInformationMessage('Credenciais do StackSpot salvas com sucesso!');
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Define o conteúdo HTML inicial
        this._update();

        // Escuta quando o painel é fechado
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        HelloWorldPanel.currentPanel = undefined;

        // Limpa os recursos
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

        // Escuta mensagens do webview
        webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Code Hive: Desenvolvimento Agile</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            max-width: 500px;
            width: 90%;
        }
        
        h1 {
            font-size: 3rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            animation: fadeInUp 1s ease-out;
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
            animation: fadeInUp 1s ease-out 0.3s both;
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
            animation: fadeInUp 1s ease-out 0.6s both;
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        
        .button.secondary {
                 background: linear-gradient(135deg, #6c757d, #495057);
                 margin-top: 10px;
             }
             
             .button.secondary:hover {
                 background: linear-gradient(135deg, #5a6268, #343a40);
                 transform: translateY(-3px);
             }
             
             .settings-screen {
                 display: none;
                 background: rgba(255, 255, 255, 0.1);
                 backdrop-filter: blur(20px);
                 border-radius: 20px;
                 padding: 30px;
                 margin-top: 20px;
                 border: 1px solid rgba(255, 255, 255, 0.2);
                 animation: fadeIn 0.5s ease-in-out;
             }
             
             .settings-screen.active {
                 display: block;
             }
             
             .settings-title {
                 color: #fff;
                 font-size: 24px;
                 margin-bottom: 20px;
                 text-align: center;
             }
             
             .setting-item {
                 margin-bottom: 20px;
                 padding: 15px;
                 background: rgba(255, 255, 255, 0.05);
                 border-radius: 10px;
                 border: 1px solid rgba(255, 255, 255, 0.1);
             }
             
             .setting-label {
                 color: #fff;
                 font-weight: bold;
                 margin-bottom: 8px;
                 display: block;
             }
             
             .setting-input {
                 width: 100%;
                 padding: 10px;
                 border: none;
                 border-radius: 8px;
                 background: rgba(255, 255, 255, 0.1);
                 color: #fff;
                 font-size: 14px;
             }
             
             .setting-input::placeholder {
                 color: rgba(255, 255, 255, 0.6);
             }
             
             .setting-checkbox {
                 margin-right: 10px;
             }
             
             .back-button {
                 background: linear-gradient(135deg, #dc3545, #c82333);
                 color: white;
                 border: none;
                 padding: 10px 20px;
                 border-radius: 25px;
                 cursor: pointer;
                 font-size: 14px;
                 font-weight: bold;
                 margin-top: 20px;
                 transition: all 0.3s ease;
             }
             
             .back-button:hover {
                  background: linear-gradient(135deg, #c82333, #bd2130);
                  transform: translateY(-2px);
              }
              
              .test-button {
                  background: linear-gradient(135deg, #28a745, #20c997);
                  color: white;
                  border: none;
                  padding: 12px 24px;
                  border-radius: 25px;
                  cursor: pointer;
                  font-size: 14px;
                  font-weight: bold;
                  margin: 20px 10px 10px 0;
                  transition: all 0.3s ease;
                  display: inline-block;
              }
              
              .test-button:hover {
                  background: linear-gradient(135deg, #218838, #1e7e34);
                  transform: translateY(-2px);
              }
              
              .test-button:disabled {
                  background: linear-gradient(135deg, #6c757d, #495057);
                  cursor: not-allowed;
                  transform: none;
              }
              
              .connection-status {
                  padding: 12px;
                  border-radius: 8px;
                  margin: 15px 0;
                  font-size: 14px;
                  font-weight: 500;
                  text-align: center;
                  transition: all 0.3s ease;
                  border: 1px solid transparent;
              }
              
              .status-idle {
                  background: rgba(100, 116, 139, 0.1);
                  color: #64748b;
                  border-color: rgba(100, 116, 139, 0.2);
              }
              
              .status-testing {
                  background: rgba(59, 130, 246, 0.1);
                  color: #3b82f6;
                  border-color: rgba(59, 130, 246, 0.2);
                  animation: pulse 2s infinite;
              }
              
              .status-success {
                  background: rgba(34, 197, 94, 0.1);
                  color: #22c55e;
                  border-color: rgba(34, 197, 94, 0.2);
              }
              
              .status-error {
                  background: rgba(239, 68, 68, 0.1);
                  color: #ef4444;
                  border-color: rgba(239, 68, 68, 0.2);
              }
              
              @keyframes pulse {
                  0% { opacity: 1; }
                  50% { opacity: 0.6; }
                  100% { opacity: 1; }
              }
              
              .info {
                   margin-top: 30px;
                   padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            font-size: 0.9rem;
            animation: fadeInUp 1s ease-out 0.9s both;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
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
        <div class="emoji">🚀</div>
        <h1>Desenvolvimento Agile</h1>
        <p>Bem-vindo ao AI Code Hive - sua ferramenta para desenvolvimento ágil e produtivo!</p>
        <button class="button" onclick="showMessage()">Vamos começar!</button>
         <button class="button secondary" onclick="showSettings()">Configurações</button>
        
        <div class="info">
             <strong>🎯 AI Code Hive: Desenvolvimento Agile</strong><br>
             Focado em produtividade e metodologias ágeis<br>
             <small>Versão 1.0.0</small>
         </div>
         
         <div class="settings-screen" id="settingsScreen">
             <h2 class="settings-title">⚙️ Configurações</h2>
             
             <div class="setting-item">
                 <label class="setting-label">Client ID (StackSpot):</label>
                 <input type="text" class="setting-input" placeholder="Digite seu Client ID do StackSpot" id="clientId">
             </div>
             
             <div class="setting-item">
                 <label class="setting-label">Client Secret (StackSpot):</label>
                 <input type="password" class="setting-input" placeholder="Digite seu Client Secret do StackSpot" id="clientSecret">
             </div>
             
             <div style="text-align: center; margin-top: 20px;">
                 <button class="test-button" onclick="testConnection()">🔗 Testar Conexão</button>
             </div>
             
             <div class="connection-status status-idle" id="connectionStatus">
                 ⚪ Aguardando teste de conexão...
             </div>
             
             <button class="back-button" onclick="hideSettings()">← Voltar</button>
         </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function showMessage() {
             vscode.postMessage({
                 command: 'alert',
                 text: 'Bem-vindo ao AI Code Hive: Desenvolvimento Agile! 🚀'
             });
         }
         
         function showSettings() {
             document.getElementById('settingsScreen').classList.add('active');
             document.querySelector('.container > .emoji').style.display = 'none';
             document.querySelector('.container > h1').style.display = 'none';
             document.querySelector('.container > p').style.display = 'none';
             document.querySelector('.button:not(.back-button)').style.display = 'none';
             document.querySelector('.button.secondary').style.display = 'none';
             document.querySelector('.info').style.display = 'none';
         }
         
         function hideSettings() {
              document.getElementById('settingsScreen').classList.remove('active');
              document.querySelector('.container > .emoji').style.display = 'block';
              document.querySelector('.container > h1').style.display = 'block';
              document.querySelector('.container > p').style.display = 'block';
              document.querySelector('.button:not(.back-button)').style.display = 'inline-block';
              document.querySelector('.button.secondary').style.display = 'inline-block';
              document.querySelector('.info').style.display = 'block';
          }
          
          async function testConnection() {
              const clientIdInput = document.getElementById('clientId');
              const clientSecretInput = document.getElementById('clientSecret');
              const statusElement = document.getElementById('connectionStatus');
              const testButton = document.querySelector('.test-button');

              const clientId = clientIdInput?.value?.trim();
              const clientSecret = clientSecretInput?.value?.trim();

              // Validação dos campos
              if (!clientId || !clientSecret) {
                  updateConnectionStatus('error', '❌ Por favor, preencha Client ID e Client Secret');
                  return;
              }

              // Atualizar UI para estado de teste
              testButton.disabled = true;
              testButton.innerHTML = '🔄 Testando...';
              updateConnectionStatus('testing', '🔄 Testando conexão com StackSpot...');

              try {
                  // Preparar dados para o POST request
                  const formData = new URLSearchParams();
                  formData.append('client_id', clientId);
                  formData.append('client_secret', clientSecret);
                  formData.append('grant_type', 'client_credentials');

                  // Fazer POST request para o endpoint do StackSpot
                  const response = await fetch('https://idm.stackspot.com/stackspot-freemium/oidc/oauth/token', {
                      method: 'POST',
                      headers: {
                          'Content-Type': 'application/x-www-form-urlencoded'
                      },
                      body: formData.toString()
                  });

                  if (response.ok) {
                      const data = await response.json();
                      
                      if (data.access_token) {
                          // Notificar o VS Code sobre o sucesso
                          vscode.postMessage({
                              command: 'saveCredentials',
                              clientId: clientId,
                              clientSecret: clientSecret,
                              accessToken: data.access_token,
                              expiresIn: data.expires_in
                          });
                          
                          updateConnectionStatus('success', '✅ Conexão estabelecida com sucesso! Token obtido.');
                      } else {
                          updateConnectionStatus('error', '❌ Resposta inválida da API');
                      }
                  } else {
                      const errorText = await response.text();
                      let errorMessage = 'Erro na autenticação';
                      
                      try {
                           const errorData = JSON.parse(errorText);
                           errorMessage = errorData.error_description || errorData.error || errorMessage;
                       } catch {
                           errorMessage = 'Erro HTTP ' + response.status + ': ' + response.statusText;
                       }
                       
                       updateConnectionStatus('error', '❌ ' + errorMessage);
                  }
              } catch (error) {
                  console.error('Erro ao testar conexão:', error);
                  updateConnectionStatus('error', '❌ Erro de rede. Verifique sua conexão com a internet.');
              } finally {
                  // Restaurar botão
                  testButton.disabled = false;
                  testButton.innerHTML = '🔗 Testar Conexão';
              }
          }

          function updateConnectionStatus(status, message) {
               const statusElement = document.getElementById('connectionStatus');
               if (statusElement) {
                   statusElement.className = 'connection-status status-' + status;
                   statusElement.textContent = message;
               }
           }
        
        // Animação de entrada
        window.addEventListener('load', function() {
            document.body.style.opacity = '1';
        });
    </script>
</body>
</html>`;
    }
}

export function deactivate() {}