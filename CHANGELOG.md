# Histórico de versões

## 1.3.0-beta.1 — Pastas sem burocracia

- Criação de pastas por linguagem natural, sem inferência nem confirmação.
- Nome em continuação curta quando o pedido vier incompleto.
- `/mkdir` e `make_directory` do agente executam diretamente.
- Resolução da Área de Trabalho, Downloads e Documentos com XDG no Linux.
- Abertura imediata; conexão com modelo sob demanda.
- Nova tela inicial, conversa em cartões, última ação, Ctrl+K e F1.

## 1.2.0-beta.2 — Verificação de malware

- Pedidos defensivos de busca de vírus no próprio PC são tratados antes da inferência.
- `/scan` e `/scan CAMINHO` com ClamAV ou Defender, confirmação e detecção sem solicitar remediação.
- Relatórios distinguem ausência de detecções, infecção, erro e interrupção.
- “Agora” no final do pedido de apelido não é salvo como parte do nome.

## 1.2.0-beta.1 — Agente e personalização

- Ciclo de ferramentas nativas Ollama, resultados reais e confirmação antes de alterações.
- Arquivos, pastas, comandos, diretório de trabalho e builds C/C++/Python.
- Apelido por linguagem natural, `/name` e `/personality`, persistidos fora do projeto.
- Publicação pública com `npm run publish:beta -- --public`.
- Compilação e execução real de um programa C no Linux verificadas.

## 1.1.0-beta.2 — Correção de identidade

- Resposta fixa de autoria para perguntas diretas sobre Scarlett, independente do modelo.
- Crédito: mark.code, um dev solo.
- Perguntas sobre outros projetos e solicitações compostas continuam no modelo.

## 1.1.0-beta.1 — Scarlett 1.1

- Instalação opcional de `scarlett:turbo` com Qwen2.5 1.5B e `scarlett:balanced` com 3B.
- Perfis Turbo, Equilibrado e Completo com orçamento de histórico por turnos completos.
- `/warmup`, `/stats` e benchmark reproduzível.
- Interface com painel lateral responsivo, cartões e blocos de código.
- Renderização diferencial, cache de mensagens e atualização de streaming agrupada.
- `/train export`, `/train check` e `/train start` com confirmação.
- Validação de dataset sem ML, deduplicação e preservação de diretórios de treino.
- README visual, prévia gerada pela interface e guias separados.

## 1.0.0-beta.1 — Scarlett Beta 1.0

Primeira beta: inferência local via Ollama, terminal em tela inteira, menu de modelos, sessões, execução de comandos com confirmação e script opcional de LoRA.
