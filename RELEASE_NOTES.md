# Scarlett 1.1 Beta

Criada por **mark.code, um dev solo**.

Correção beta.2: perguntas diretas sobre identidade e criador agora recebem uma resposta fixa do aplicativo, sem depender do modelo ou do Ollama.

## Uma nova experiência no terminal

Painel lateral em janelas grandes, cartões de acesso rápido, blocos de código destacados, menus por setas e entrada fixa. A renderização atualiza somente linhas alteradas e reutiliza mensagens já formatadas.

## Mais opções de desempenho

- `/setup` instala Scarlett Turbo com Qwen2.5 1.5B.
- `/setup balanced` instala a alternativa 3B.
- `/speed` seleciona contexto e limite de resposta.
- `/warmup` pré-carrega o modelo; `/stats` mostra métricas reais.
- `npm run bench` mede gerações após warmup de forma reproduzível.

A instalação nova preserva os modelos anteriores. Modelo menor e contexto reduzido envolvem compromissos de qualidade; respostas instantâneas não são garantidas.

## Treinamento integrado

Exporte a conversa com `/train export`, valide com `/train check` e prepare LoRA com `/train start`. O treino só começa após confirmação por `TREINAR`, exige dependências Python separadas e pode baixar pesos e consumir muitos recursos. A beta não inclui pesos próprios treinados.

## Apresentação do projeto

README com capa e prévia SVG da interface, guias de treinamento, desempenho e solução de problemas, histórico de versões e instruções para contribuir.

## Validação e limitações

21 testes JavaScript e 6 testes Python passaram no ambiente Linux. O cliente de inferência e a inicialização do backend são testados com simulações; inferência real, importação de pesos e treino completo ainda não foram validados neste ambiente. CI está configurado para Linux e Windows, mas resultado remoto ainda não foi observado. O comportamento das respostas depende do modelo, do prompt e dos dados; não há garantia de respostas irrestritas.
