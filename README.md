# 🚀 AICodeHive - Hello World

Uma extensão simples para Visual Studio Code que exibe uma interface "Hello World" bonita e interativa.

## ✨ Funcionalidades

- **Interface moderna**: Design com gradientes e animações
- **Interatividade**: Botão que exibe mensagem no VSCode
- **Responsivo**: Interface adaptável a diferentes tamanhos

## 🛠️ Como Usar

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Compilar o projeto**:
   ```bash
   npm run compile
   ```

3. **Executar a extensão**:
   - Pressione `F5` no VSCode para abrir uma nova janela com a extensão
   - Use `Ctrl+Shift+P` e digite "AICodeHive: Hello World"

## 📂 Estrutura do Projeto

```
ai-code-hive-2/
├── src/
│   └── extension.ts          # Código principal da extensão
├── .vscode/
│   ├── launch.json          # Configuração de debug
│   └── tasks.json           # Tarefas de build
├── package.json             # Configurações da extensão
├── tsconfig.json           # Configuração TypeScript
└── README.md               # Esta documentação
```

## 🎯 Como Funciona

A extensão registra um comando `aicodehive.helloWorld` que:

1. Abre um painel webview no VSCode
2. Exibe uma interface HTML com CSS moderno
3. Permite interação através de JavaScript
4. Comunica com o VSCode através de mensagens

## 🚀 Próximos Passos

Esta é uma base simples que você pode expandir para:

- Adicionar mais comandos
- Criar formulários interativos
- Integrar com APIs
- Manipular arquivos do workspace
- Adicionar configurações personalizadas

---

**Desenvolvido com ❤️ para aprender desenvolvimento de extensões VSCode**