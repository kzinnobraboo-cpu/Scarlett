# Verificação local de malware

Diga “vc pode vasculhar meu pc pra tentar achar algum virus” ou digite:

```text
/scan
```

O aplicativo reconhece esse pedido defensivo antes de consultar o modelo. O alvo padrão é a pasta pessoal do usuário. Para escolher outra pasta ou arquivo:

```text
/scan ~/Downloads
```

A prévia informa motor, alvo e limite de 30 minutos. Digite `EXECUTAR` para iniciar. Pastas grandes podem demorar; Esc pede interrupção. No Defender, o serviço pode continuar trabalhando mesmo após interromper o processo de linha de comando.

## Linux, incluindo Garuda

É necessário ClamAV com banco de assinaturas. No Garuda/Arch, a preparação usual é:

```sh
sudo pacman -S clamav
sudo freshclam
```

Scarlett não executa instalação nem atualização automaticamente. Se `freshclam` indicar serviço já ativo ou configuração inválida, confira a configuração local e a documentação do ClamAV. Mantenha as assinaturas atualizadas antes de confiar no resultado. Depois use `/scan` no aplicativo.

## Windows

Scarlett procura ClamAV no PATH e também MpCmdRun do Microsoft Defender nas pastas de plataforma e Program Files. O modo Defender usa uma varredura customizada com `-DisableRemediation` e pode exigir um terminal como administrador. O aplicativo não eleva privilégios sozinho nem altera políticas de proteção do sistema.

## O que o relatório significa

- ClamAV código 0: o motor não relatou detecções nessa execução.
- ClamAV código 1: o motor relatou detecções; revise caminhos e assinaturas.
- Erro, timeout ou cancelamento: análise incompleta; não é um resultado limpo.
- Outros códigos do Defender precisam ser interpretados com o relatório; o aplicativo não os trata automaticamente como infecção confirmada.

Não são passadas opções de apagar, mover ou quarentenar ao ClamAV; Defender recebe desativação de remediação para essa execução. A saída fica no histórico em memória, com limite no trecho exibido. A proteção residente e políticas do próprio antivírus continuam sob controle do sistema.

A análise cobre somente o alvo informado e os arquivos acessíveis, conforme limites do motor, arquivos ignorados e assinaturas disponíveis. Não é investigação forense, verificação completa de memória ou prova de que o computador inteiro esteja livre de malware. Este recurso foi testado com motores simulados; uma varredura real não foi executada no ambiente de desenvolvimento.

Referências: [uso do ClamAV](https://docs.clamav.net/manual/Usage/Scanning.html), [MpCmdRun do Defender](https://learn.microsoft.com/en-us/defender-endpoint/command-line-arguments-microsoft-defender-antivirus).
