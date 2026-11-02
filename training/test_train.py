import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from train import load_rows


class DatasetTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / 'data.jsonl'
        self.sample = {'messages': [{'role': 'user', 'content': 'Oi'}, {'role': 'assistant', 'content': 'Olá'}]}

    def tearDown(self):
        self.directory.cleanup()

    def write(self, rows):
        self.path.write_text('\n'.join(json.dumps(r) for r in rows), encoding='utf-8')

    def test_duplicates_removed_before_split(self):
        self.write([self.sample, self.sample])
        rows, duplicates = load_rows(self.path)
        self.assertEqual(len(rows), 1)
        self.assertEqual(duplicates, 1)

    def test_bad_role_rejected(self):
        self.write([{'messages': [{'role': 'assistant', 'content': 'fora de ordem'}]}])
        with self.assertRaisesRegex(ValueError, 'esperado papel user'):
            load_rows(self.path)

    def test_missing_answer_rejected(self):
        self.write([{'messages': [{'role': 'user', 'content': 'sem resposta'}]}])
        with self.assertRaisesRegex(ValueError, 'terminar com assistant'):
            load_rows(self.path)

    def test_invalid_json_reports_line(self):
        self.path.write_text('{oops}', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Linha 1'):
            load_rows(self.path)

    def test_system_only_rejected(self):
        self.write([{'messages': [{'role': 'system', 'content': 'sistema'}]}])
        with self.assertRaises(ValueError):
            load_rows(self.path)

    def test_validate_cli_needs_no_ml_dependencies(self):
        self.write([self.sample])
        script = Path(__file__).with_name('train.py')
        result = subprocess.run([sys.executable, str(script), '--data', str(self.path), '--validate-only'], capture_output=True, text=True, encoding='utf-8', env={**os.environ, 'PYTHONUTF8': '1'})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Dataset válido', result.stdout)


if __name__ == '__main__':
    unittest.main()
