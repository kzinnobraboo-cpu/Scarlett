# Scarlett 1.2 Beta

Criada por **mark.code, um dev solo**.

Correção beta.2: pedidos de verificação de vírus no próprio computador agora abrem um fluxo nativo de antivírus, sem depender do modelo. Use `/scan` ou `/scan CAMINHO`. A execução exige confirmação e pede detecção sem remoção/quarentena. ClamAV deve estar instalado e atualizado; no Windows há detecção do Defender. “Agora” no final de um pedido de apelido não é mais incluído no nome.

## Agente com ferramentas reais

Scarlett pode listar e ler arquivos, propor pastas, criar/editar texto, executar comandos e compilar programas. O modelo recebe os resultados e pode continuar a tarefa. Alterações, comandos e builds aguardam confirmação por `EXECUTAR`; Esc interrompe. O agente vem ativo e exige um modelo com suporte a ferramentas nativas do Ollama.

Atalhos `/cd`, `/ls`, `/read`, `/mkdir`, `/write` e `/build` funcionam sem inferência. Acesso usa as permissões do usuário, inclusive caminhos fora do projeto; não concede administrador.

## Personalização persistente

Diga “me chame de chefia” ou use `/name Chefia`. Scarlett salva o apelido e o utiliza nas próximas conversas. `/personality` mostra ou altera o estilo; `/name reset` e `/personality reset` restauram as opções. Preferências são guardadas fora do repositório por padrão. O criador continua sendo mark.code.

## Builds e treinamento

Builds diretos suportam C/C++ com GCC/G++ e Python com PyInstaller instalado. `.exe` de C/C++ no Linux exige MinGW; `.exe` Python exige build no Windows. Os perfis de desempenho, `/warmup` e Training Studio (`/train`) continuam disponíveis. Preferências não substituem treinamento de pesos.

## GitHub público

`npm run publish:beta -- --public` publica branch e tag, cria/atualiza a prerelease e cria um repositório público ou torna público o origin existente. README, capa, prévia e guias acompanham o código. O script exige GitHub CLI autenticado e rede; não força o histórico Git.

## Validação e limites

41 testes JavaScript e 6 testes Python passaram no Linux. Um programa C foi criado, compilado com GCC e executado pelo mecanismo de ferramentas. Planejamento com um modelo real, compilação para Windows e treinamento completo ainda não foram validados neste ambiente. O agente foi testado com respostas de modelo simuladas. Desempenho depende do hardware e dos pesos; não há garantia de ações instantâneas ou respostas irrestritas.

O fluxo de antivírus foi testado com respostas de motor simuladas; nenhum antivírus real foi executado neste ambiente, onde ClamAV não está instalado. Uma varredura sem detecções não comprova ausência de malware.
