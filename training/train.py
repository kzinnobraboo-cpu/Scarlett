"""Ajuste LoRA opcional. Não faz parte das dependências do terminal."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True, help='ID do modelo base no Hugging Face')
    parser.add_argument('--data', required=True, help='JSONL de conversas')
    parser.add_argument('--output', default='training/output')
    parser.add_argument('--epochs', type=float, default=1)
    parser.add_argument('--merge', action='store_true', help='Salvar também pesos mesclados')
    args = parser.parse_args()
    rows = [json.loads(line) for line in Path(args.data).read_text(encoding='utf-8').splitlines() if line.strip()]
    if len(rows) < 2:
        parser.error('Forneça ao menos duas conversas; use um conjunto maior para treino útil.')
    for row in rows:
        if not isinstance(row.get('messages'), list) or not row['messages']:
            parser.error('Cada linha precisa de uma lista messages não vazia.')
        for message in row['messages']:
            if message.get('role') not in ('system', 'user', 'assistant') or not isinstance(message.get('content'), str):
                parser.error('Mensagem inválida no dataset.')
    from datasets import Dataset
    from peft import LoraConfig
    from trl import SFTConfig, SFTTrainer

    dataset = Dataset.from_list(rows).train_test_split(test_size=0.1, seed=42)
    trainer = SFTTrainer(
        model=args.model,
        train_dataset=dataset['train'],
        eval_dataset=dataset['test'],
        peft_config=LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules='all-linear', task_type='CAUSAL_LM'),
        args=SFTConfig(
            output_dir=args.output, num_train_epochs=args.epochs,
            per_device_train_batch_size=1, gradient_accumulation_steps=8,
            learning_rate=2e-4, max_length=1024, gradient_checkpointing=True,
            logging_steps=1, eval_strategy='epoch', save_strategy='epoch', report_to='none',
        ),
    )
    trainer.train()
    trainer.save_model(args.output)
    trainer.processing_class.save_pretrained(args.output)
    if args.merge:
        merged = trainer.model.merge_and_unload()
        merged.save_pretrained(f'{args.output}/merged', safe_serialization=True)
        trainer.processing_class.save_pretrained(f'{args.output}/merged')


if __name__ == '__main__':
    main()
