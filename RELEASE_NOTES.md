# Scarlett Beta 1.0

Criada por **mark.code, um dev solo**.

Primeira versão beta da assistente local para terminal, destinada a Linux e Windows.

- Interface em tela inteira com menu de comandos e seletor de modelos.
- Respostas em streaming pelo Ollama local.
- Inicialização automática do Ollama, `/connect` e preparação por `/setup`.
- Sessões com `/save`, `/load` e `/new`.
- Execução de comandos no computador com confirmação por `/run`.
- Modos de desempenho e simulação.
- Personalidade configurável, exemplos e script opcional de treinamento LoRA.

Requer Node.js 22+ e Ollama. O download inicial do modelo precisa de internet.

Validação: 12 testes automatizados passaram no ambiente Linux. O fluxo de inferência com um modelo real, o treinamento e a execução no Windows ainda precisam de validação. Nenhum peso próprio treinado está incluído. Desempenho e respostas dependem do modelo e do hardware.
