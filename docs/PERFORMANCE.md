# Medir desempenho

A 1.1 oferece redução de trabalho de contexto, um modelo inicial menor e menos trabalho de renderização. São mudanças de implementação; não são prova de uma determinada velocidade no seu computador.

## Modelo e perfil são escolhas separadas

`/setup` instala `scarlett:turbo`, baseado no [Qwen2.5 1.5B quantizado](https://ollama.com/library/qwen2.5:1.5b). `/setup balanced` instala `scarlett:balanced`, baseado no 3B. O modelo menor pode perder capacidade em código ou instruções complexas.

`/speed` abre os perfis de contexto e limite de geração. O perfil Turbo envia menos histórico e pede saídas menores. Isso pode reduzir latência ou tempo total, mas não promete mais tokens/s para um mesmo modelo em todo hardware. A pergunta atual e o system prompt continuam completos, e podem ultrapassar o contexto do backend. O limite de caracteres do histórico é aproximado.

## Carregamento e streaming

`/warmup` faz uma solicitação de geração com prompt vazio para carregar o modelo. O tempo de pré-carga existe e não deve ser escondido ao medir uma sessão a frio. Solicitações usam `keep_alive: 30m`; o serviço pode descarregar o modelo antes por pressão de memória ou outras configurações. Streaming mostra os tokens recebidos sem espera artificial no caminho de inferência real.

A UI limita atualizações de streaming a cerca de 30 quadros/s, usa cache de mensagens já formatadas e reescreve apenas linhas alteradas. A animação de atividade roda a 10 quadros/s enquanto há uma operação. Isso evita despejar a tela inteira a cada token; não aumenta a capacidade de inferência dos pesos.

## Medir no seu computador

Instale o modelo e certifique-se de que Ollama está acessível. Fora da Scarlett:

```sh
npm run bench -- --model scarlett:turbo --profile turbo --runs 3
npm run bench -- --model scarlett:balanced --profile balanced --runs 3
```

Para salvar sem sobrescrever um arquivo existente:

```sh
npm run bench -- --model scarlett:turbo --profile turbo --runs 3 --output resultado-turbo.json
```

O benchmark faz pré-carga, depois repete uma pergunta fixa. O relatório JSON registra plataforma, modelo, perfil, primeiro token, tempo total, tokens gerados e tokens/s reportados pelo backend. Ele mede **execuções após warmup**, não inicialização a frio. Compare também qualidade e correção das respostas. As medições não incluem um treinamento nem demonstram desempenho de tarefas mais longas.

Dentro da conversa, `/stats` mostra as métricas da última inferência concluída. Demo não gera métricas falsas. A configuração da beta não força ROCm nem presume aceleração na GPU integrada; consulte o suporte do Ollama para seu dispositivo.

Referências: [API de chat](https://docs.ollama.com/api/chat), [API de geração](https://docs.ollama.com/api/generate), [FAQ](https://docs.ollama.com/faq).
