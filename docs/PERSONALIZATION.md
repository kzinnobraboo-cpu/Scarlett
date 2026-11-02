# Personalizar Scarlett

## Apelido com resposta imediata

```text
a partir de agora sou seu dono me chame de chefia
```

Scarlett identifica esse pedido diretamente no aplicativo, salva “chefia” e confirma sem fazer inferência. O apelido aparece nas respostas e na tela inicial, inclusive após reiniciar. A frase “sou seu dono” é entendida como forma de tratamento; não muda o criador do aplicativo ou as permissões do sistema.

Também funciona com “me chama de chefia” e “pode me chamar de chefia”. Pedidos compostos, como “crie um programa e me chame de chefia”, continuam no modelo para não descartar o restante da tarefa. Para persistir sem ambiguidade, use:

```text
/name Chefia
```

## Estilo

```text
/personality Responda em português, de forma direta, com código quando necessário.
/personality
```

A primeira linha salva o estilo; a segunda mostra a configuração. O modelo recebe essas preferências nas próximas solicitações. Como qualquer prompt, ele pode não seguir todas as instruções perfeitamente. Perguntas diretas de autoria continuam recebendo o crédito fixo de mark.code.

## Restaurar

```text
/name reset
/personality reset
```

O primeiro limpa o apelido. O segundo limpa só o estilo. Nenhum deles apaga conversas ou modelos.

## Armazenamento

Linux: `$XDG_CONFIG_HOME/scarlett/preferences.json`, ou `~/.config/scarlett/preferences.json` quando XDG_CONFIG_HOME não está definido. Windows: `%APPDATA%\Scarlett\preferences.json`, com fallback para a pasta pessoal. `SCARLETT_CONFIG_HOME` permite escolher outra pasta.

Preferências ficam fora do repositório por padrão e são gravadas como texto simples, com acesso restrito ao usuário em sistemas que respeitam o modo POSIX. Não coloque segredos no estilo. A personalização não faz ajuste de pesos; para LoRA, siga [o guia de treinamento](TRAINING.md).
