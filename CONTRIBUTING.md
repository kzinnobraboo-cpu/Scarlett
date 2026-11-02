# Contribuir com Scarlett

Antes de alterar, execute os testes. O terminal usa Node.js 22+ e biblioteca padrão; a suíte de desenvolvimento também usa Python 3.11+. Inferência e treinamento são componentes separados.

```sh
npm test
python -m unittest discover -s training -p "test_*.py"
```

No Linux, `python3` pode ser necessário. Bibliotecas de ML não são exigidas para esses testes.

## Organização

| Caminho | Responsabilidade |
| --- | --- |
| `src/cli.js` | Comandos e fluxo de conversa |
| `src/ui.js` | Layout, teclado, cache e atualização diferencial |
| `src/core.js` | Cliente Ollama, personalidade e comandos de sistema |
| `src/agent.js` | Ciclo de ferramentas e pausas para confirmação |
| `src/pc-tools.js` | Arquivos, diretórios, comandos e builds |
| `src/preferences.js` | Apelido e estilo persistentes |
| `src/profiles.js` | Perfis e orçamento de histórico |
| `src/backend.js` | Inicialização do Ollama e preparação de modelos |
| `src/training.js` | Exportação e processo Python sem shell |
| `training/train.py` | Validação de dados e SFT com LoRA |
| `scripts/` | Benchmark, prévia e publicação |

## Enviar mudanças

Descreva o problema observado, o comportamento após a mudança e como verificou. Inclua sistema operacional, versão de Node e Ollama em bugs. Em alterações visuais, execute `npm run preview` e revise o SVG gerado.

Não coloque conversas privadas, credenciais, datasets particulares ou pesos no Git. Sessões, `.venv`, pesos e dados no caminho padrão já são ignorados. Um arquivo fora desses caminhos precisa de revisão antes do commit.

Números de desempenho devem indicar modelo, perfil, hardware e se houve warmup. Não apresente demo como inferência nem um teste simulado como benchmark real.
