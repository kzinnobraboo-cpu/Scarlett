"""Scarlett 1.1: validar dados e treinar LoRA. Validação usa só a biblioteca padrão."""
import argparse
import json
from pathlib import Path


def load_rows(path):
    rows, seen, duplicates = [], set(), 0
    with Path(path).open(encoding='utf-8') as source:
        for line_number, line in enumerate(source, 1):
            if not line.strip():
                continue
            if len(line) > 1_000_000:
                raise ValueError(f'Linha {line_number}: limite de 1 MB por conversa.')
            try:
                row = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f'Linha {line_number}: JSON inválido: {error.msg}') from error
            messages = row.get('messages') if isinstance(row, dict) else None
            if not isinstance(messages, list) or not messages:
                raise ValueError(f'Linha {line_number}: esperado objeto com messages não vazio.')
            normalized = []
            for index, message in enumerate(messages):
                if not isinstance(message, dict):
                    raise ValueError(f'Linha {line_number}: mensagem inválida.')
                role, content = message.get('role'), message.get('content')
                if not isinstance(content, str) or not content.strip() or len(content) > 100_000:
                    raise ValueError(f'Linha {line_number}: conteúdo vazio, inválido ou acima de 100 mil caracteres.')
                if index == 0 and role == 'system':
                    normalized.append({'role': role, 'content': content})
                    continue
                offset = 1 if normalized and normalized[0]['role'] == 'system' else 0
                expected = 'user' if (index - offset) % 2 == 0 else 'assistant'
                if role != expected:
                    raise ValueError(f'Linha {line_number}: esperado papel {expected} na mensagem {index + 1}.')
                normalized.append({'role': role, 'content': content})
            if normalized[-1]['role'] != 'assistant':
                raise ValueError(f'Linha {line_number}: conversa precisa terminar com assistant.')
            key = json.dumps(normalized, ensure_ascii=False, sort_keys=True)
            if key in seen:
                duplicates += 1
            else:
                seen.add(key)
                rows.append({'messages': normalized})
    if not rows:
        raise ValueError('Dataset vazio.')
    return rows, duplicates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='Qwen/Qwen2.5-0.5B-Instruct')
    parser.add_argument('--data', required=True, help='JSONL de conversas revisadas')
    parser.add_argument('--output', default='training/output')
    parser.add_argument('--epochs', type=float, default=1)
    parser.add_argument('--max-length', type=int, default=1024)
    parser.add_argument('--validate-only', action='store_true', help='Não instala nem importa dependências de ML')
    parser.add_argument('--merge', action='store_true', help='Salvar também pesos mesclados')
    args = parser.parse_args()
    try:
        rows, duplicates = load_rows(args.data)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(f'Dataset válido: {len(rows)} conversas únicas; {duplicates} duplicadas removidas.', flush=True)
    if len(rows) < 20:
        print('Conjunto pequeno: útil para testar o fluxo, insuficiente para demonstrar qualidade.', flush=True)
    if args.validate_only:
        return
    if len(rows) < 2 or args.epochs <= 0 or args.max_length < 128:
        parser.error('Treino exige ao menos 2 conversas únicas, epochs > 0 e max-length >= 128.')
    if Path(args.output).exists() and any(Path(args.output).iterdir()):
        parser.error('Pasta de saída não vazia. Escolha um novo --output para preservar o treino anterior.')
    try:
        from datasets import Dataset
        from peft import LoraConfig
        from trl import SFTConfig, SFTTrainer
    except ImportError as error:
        parser.error(f'Dependências ausentes: {error}. Instale training/requirements.txt no ambiente Python selecionado.')
    dataset = Dataset.from_list(rows).train_test_split(test_size=0.1, seed=42)
    trainer = SFTTrainer(
        model=args.model,
        train_dataset=dataset['train'],
        eval_dataset=dataset['test'],
        peft_config=LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules='all-linear', task_type='CAUSAL_LM'),
        args=SFTConfig(
            output_dir=args.output, num_train_epochs=args.epochs,
            per_device_train_batch_size=1, gradient_accumulation_steps=8,
            learning_rate=2e-4, max_length=args.max_length, gradient_checkpointing=True,
            logging_steps=1, eval_strategy='epoch', save_strategy='epoch', report_to='none', seed=42,
        ),
    )
    trainer.train()
    trainer.save_model(args.output)
    trainer.processing_class.save_pretrained(args.output)
    if args.merge:
        merged = trainer.model.merge_and_unload()
        merged.save_pretrained(f'{args.output}/merged', safe_serialization=True)
        trainer.processing_class.save_pretrained(f'{args.output}/merged')
    print(f'Treinamento concluído: {args.output}', flush=True)


if __name__ == '__main__':
    main()
