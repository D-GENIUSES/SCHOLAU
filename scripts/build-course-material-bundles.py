"""Build reviewable per-course bundles from the existing private source inventory.

No network access or publishing. Only sources already referenced by the reviewed
question ledger are included; raw attachments are never executed.
"""
import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import re


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def build(intake, bank):
    inventory = {item['id']: item for item in read(intake / 'inventory.json')['materials']}
    questions = read(bank / 'questions.json')
    evidence = {item['logical_question_key']: item for item in read(bank / 'evidence.json')}
    validation = read(bank / 'validation.json')
    if hashlib.sha256((bank / 'questions.json').read_bytes()).hexdigest() != validation['bankSha256']:
        raise ValueError('Question bank differs from its validation ledger')
    held = {'3f2202ec0a', '9fb7f5e13c', '11d8805f07', 'e06f68b505', '8349052438'}
    grouped = defaultdict(list)
    for question in questions:
        grouped[question['course_code']].append(question)
    teaching = {}
    for notes in sorted(bank.glob('teaching-notes*.txt')):
        current = None
        for line in notes.read_text(encoding='utf-8-sig').splitlines():
            if not line.strip() or line.startswith('#'):
                continue
            if line.startswith('@'):
                current = line[1:]
                if current in teaching:
                    raise ValueError('Duplicate teaching course: ' + current)
                teaching[current] = []
            else:
                fields = line.split('|')
                if current is None or len(fields) != 4 or any(not value.strip() for value in fields):
                    raise ValueError('Invalid teaching notes row')
                teaching[current].append(fields)
    bundles = []
    for course, rows in sorted(grouped.items()):
        learning = sorted((q for q in rows if q['pool'] == 'learning'), key=lambda q: q['logical_question_key'])
        notes = teaching.get(course, [])
        if len(notes) != len(learning):
            raise ValueError(f'{course}: every learning concept requires authored teaching notes')
        materials = {}
        lessons = []
        for question in rows:
            proof = evidence[question['logical_question_key']]
            sha = proof['source_sha256']
            if any(sha.startswith(prefix) for prefix in held):
                raise ValueError('Excluded source referenced in bank')
            if sha[:12] not in question['source_reference']:
                raise ValueError('Source reference does not match evidence')
            source = inventory[sha]
            if source['extension'] not in ('.pdf', '.pptx', '.docx', '.txt'):
                raise ValueError('Unsupported or executable original: ' + source['filename'])
            original = (intake / source['original']).read_bytes()
            if hashlib.sha256(original).hexdigest() != sha or len(original) != source['bytes']:
                raise ValueError('Original source integrity failed')
            extracted = {page['page']: page['text'] for page in read(intake / 'extracted' / (sha + '.json'))}
            if extracted.get(proof['source_page']) != proof['source_text']:
                raise ValueError('Extracted page differs from evidence')
            materials[sha] = {'sha256': sha, 'object_key': f"course-materials/{sha}{source['extension']}", 'filename': source['filename'], 'bytes': source['bytes']}
        for question, (title, explanation, example, pitfall) in zip(learning, notes):
            proof = evidence[question['logical_question_key']]
            if len(explanation) < 80:
                raise ValueError('Teaching explanation is too short')
            blocks = [
                {'type': 'heading', 'level': 2, 'text': 'Understand the idea'},
                {'type': 'paragraph', 'text': explanation},
                {'type': 'callout', 'tone': 'example', 'title': 'Work through an example', 'text': example},
                {'type': 'callout', 'tone': 'warning', 'title': 'Avoid this mistake', 'text': pitfall},
                {'type': 'heading', 'level': 2, 'text': 'What to remember'},
                {'type': 'paragraph', 'text': question['explanation']},
                {'type': 'checkpoint', 'question': question['prompt'], 'options': [o['body'] for o in question['options']],
                 'correct_index': next(i for i, o in enumerate(question['options']) if o['label'] == question['correct_option']),
                 'explanation': question['explanation'] + ' ' + pitfall},
            ]
            lessons.append({'logical_key': question['logical_question_key'], 'source_sha256': proof['source_sha256'],
                'title': title, 'objective': 'Explain this concept in your own words and apply it to a new example.',
                'estimated_minutes': max(3, math.ceil(len((explanation + example + pitfall).split()) / 100)),
                'blocks': blocks, 'source_reference': question['source_reference']})
        bundles.append({'course_code': course, 'materials': list(materials.values()), 'lessons': lessons, 'questions': rows})
    return bundles


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--intake', type=Path, required=True)
    parser.add_argument('--bank', type=Path, default=root / 'supabase/content/computer-science-20261018')
    parser.add_argument('--out', type=Path, default=root / '.content-sync')
    args = parser.parse_args()
    bundles = build(args.intake, args.bank)
    args.out.mkdir(parents=True, exist_ok=True)
    entries = []
    for bundle in bundles:
        filename = re.sub(r'[^a-z0-9]+', '-', bundle['course_code'].lower()).strip('-') + '.json'
        data = (json.dumps(bundle, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        if len(data) > 3_900_000:
            raise ValueError('Course bundle exceeds request limit')
        (args.out / filename).write_bytes(data)
        entries.append({'course': bundle['course_code'], 'file': filename, 'sha256': hashlib.sha256(data).hexdigest(),
            'materials': len(bundle['materials']), 'lessons': len(bundle['lessons']), 'questions': len(bundle['questions'])})
    (args.out / 'manifest.json').write_text(json.dumps({'courses': entries}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'courses': len(entries), 'lessons': sum(e['lessons'] for e in entries), 'questions': sum(e['questions'] for e in entries), 'output': str(args.out)}))


if __name__ == '__main__':
    main()
