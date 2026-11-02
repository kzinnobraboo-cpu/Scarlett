# Arquivos, comandos e builds

O agente vem ativo e utiliza ferramentas reais nas pastas acessíveis ao usuário que iniciou Scarlett. Caminhos absolutos e `~` são aceitos. Não há elevação automática a administrador nem automação visual de mouse/teclado.

## Pedir em linguagem natural

> Crie uma pasta MeuApp na minha Área de Trabalho, escreva main.c com um hello world e compile para Linux.

O modelo precisa suportar ferramentas nativas do Ollama. Se não suportar, Scarlett mostra o erro e você pode escolher outro modelo em `/models`, ou usar `/agent off` com os atalhos diretos. Modelos pequenos podem falhar ao planejar ou chamar ferramentas; a capacidade não equivale à de modelos maiores de programação.

O ciclo retorna resultados ao modelo local, com limite de oito etapas e quatro chamadas por resposta. Erros, código de saída e caminho do artefato são apresentados. Leituras são limitadas e paginadas; contexto de tarefas longas pode precisar de `/speed quality`.

## Confirmação

Leitura e listagem são automáticas no agente. Criação de pasta, gravação, comandos e builds mostram uma prévia e aguardam `EXECUTAR`. Você pode percorrer a conversa com PgUp/PgDn para revisar. Esc cancela a ação pendente ou pede interrupção da execução em andamento. O agente não retoma sozinho uma ação recusada na interface.

Ao substituir arquivo, a prévia mostra antes/depois. A gravação recusa alterações externas detectadas desde a prévia. Essa proteção não substitui controle de versão nem backup.

## Atalhos sem inferência

```text
/cd ~/Área de trabalho
/ls
/mkdir MeuApp
```

Confirme a criação, depois:

```text
/write {"path":"MeuApp/main.c","content":"#include <stdio.h>\nint main(void) { puts(\"Ola, chefia!\"); return 0; }\n"}
```

Confirme e compile:

```text
/build {"source":"MeuApp/main.c","target":"native"}
```

O build usa GCC ou G++ instalado. No Linux, o resultado nativo é um binário Linux, não um `.exe` Windows. Um hello world C foi compilado e executado por essas ferramentas durante a validação.

Para ler:

```text
/read MeuApp/main.c
```

Para substituir, use `/write` com `"overwrite":true` e revise a prévia. Conteúdo deve ser texto de até 200 KB. Leituras aceitam arquivos regulares de até 1 MB, com até 300 linhas por chamada e trecho de texto limitado. O agente tem `start_line` para paginação.

## Gerar .exe no Linux

Para código C/C++, instale MinGW-w64 pelo gerenciador de pacotes do seu sistema. Scarlett procura `x86_64-w64-mingw32-gcc` ou `x86_64-w64-mingw32-g++`. A instalação não é feita silenciosamente.

```text
/build {"source":"MeuApp/main.c","target":"windows","output":"MeuApp/MeuApp.exe"}
```

O usuário confirma a compilação. Scarlett verifica a presença do arquivo de saída após sucesso do compilador. Isso não prova que ele funciona no Windows; teste no sistema alvo. MinGW não estava instalado no ambiente de desenvolvimento, portanto esse build cruzado não foi validado nele.

## Python

Instale PyInstaller no Python indicado por `SCARLETT_PYTHON`, depois:

```text
/build {"source":"MeuApp/app.py","target":"native"}
```

Para criar `.exe` de Python, execute esse build no Windows. PyInstaller não faz esse cross-build diretamente no Linux. Podem ser criados diretórios de trabalho, arquivos `.spec` e saída de build, conforme a prévia.

## Outras linguagens e processos

O agente pode chamar `execute_command`, ou você pode usar `/run` para comandos de Go, .NET, Rust, testes, gerenciadores de arquivos e outros programas instalados. O shell é `/bin/sh` no Linux e `cmd.exe` no Windows; invoque PowerShell explicitamente quando necessário.

`/run` manual tem limite de 30 segundos. Comandos do agente permitem de 1 a 300 segundos; build direto tem cinco minutos. Todos usam suas permissões. Confirmação não é uma sandbox: comandos podem acessar rede e alterar outros arquivos. Os resultados das ferramentas do agente são enviados ao modelo local para continuar a tarefa; a saída de `/run` manual não é enviada automaticamente.

Referências: [ferramentas no Ollama](https://docs.ollama.com/capabilities/tool-calling), [PyInstaller e sistema alvo](https://pyinstaller.org/en/stable/operating-mode.html).
