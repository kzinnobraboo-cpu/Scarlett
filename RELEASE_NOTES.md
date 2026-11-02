# Scarlett 1.3 Beta

Criada por **mark.code, um dev solo**.

## Peça a pasta e pronto

“Crie uma pasta chamada MeuProjeto na Área de Trabalho” agora cria a pasta diretamente, sem modelo e sem confirmação. Nome e destino podem aparecer em ordens diferentes. Se faltar o nome, Scarlett pergunta e você responde apenas o nome. `/mkdir` e a criação de pastas dentro do agente também são diretas. Pastas existentes e arquivos são preservados.

O local da Área de Trabalho, Downloads e Documentos respeita XDG no Linux quando configurado. O destino padrão é a pasta de trabalho mostrada no cabeçalho. O acesso continua limitado às permissões do usuário.

## Menos espera, nova interface

Scarlett abre sem aguardar Ollama; o modelo conecta quando necessário. A nova tela inicial mostra exemplos de pedidos, atalhos de personalização, última ação e conversa em cartões. Ctrl+K abre comandos e F1 mostra ajuda.

## Personalidade e recursos

Instruções mais diretas para tarefas legítimas, sem prometer alterar todos os comportamentos dos pesos. Apelido persistente, estilo personalizado, `/train`, `/scan`, perfis de desempenho e ferramentas de arquivos/builds continuam disponíveis. Gravação de arquivos, comandos, builds, treinamento e varreduras mantêm prévia e confirmação.

## Publicar

```sh
npm run publish:beta -- --public
```

O comando envia a versão e publica uma prerelease, criando o repositório público ou tornando público o origin existente. Exige GitHub CLI autenticado, rede e árvore Git limpa; não força histórico.

## Validação

46 testes JavaScript e 6 testes Python passaram no Linux. Criação direta de pastas foi testada em disco, incluindo nomes com espaços, pasta existente, conflito com arquivo e destino XDG. O ciclo do agente continua testado com respostas de modelo simuladas. Inferência real e testes no Windows ainda precisam de validação; não são prometidas respostas instantâneas dos pesos.
