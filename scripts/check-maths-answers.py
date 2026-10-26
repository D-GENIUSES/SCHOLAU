"""Independent symbolic checks for the reviewed parameterised question families.
Run with Python + sympy: python scripts/check-maths-answers.py.
"""
import json
import re
from pathlib import Path
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor

root = Path(__file__).resolve().parents[1]
data = root / 'supabase/content/explanatory-maths-20261025'
bundle = json.loads((data / 'mth-201.json').read_text(encoding='utf-8'))
notation = json.loads((data / 'notation-review.json').read_text(encoding='utf-8'))
reverse = {value: key for key, value in notation.items()}
x, y, C = sp.symbols('x y C')

def answer(question):
    body = next(o['body'] for o in question['options'] if o['label'] == question['correct_option'])
    source = reverse.get(body[2:-2], body) if body.startswith(r'\(') else body
    source = source.replace('²', '^2').replace('³', '^3').replace('−', '-')
    assert re.fullmatch(r'[0-9xyC+*/^().\s-]+', source), source
    return parse_expr(source, local_dict={'x': x, 'y': y, 'C': C},
                      transformations=standard_transformations + (implicit_multiplication_application, convert_xor))

for group in range(12):
    questions = bundle['questions'][54 + 7*group:61 + 7*group]
    k = group + 2
    n = (group + 1) % 4 + 1
    coefficient = k * (n + 1)
    assert sp.simplify(sp.diff(answer(questions[0]), x) - coefficient*x**n) == 0
    upper = (group + 1) % 4 + 2
    assert answer(questions[1]) == sp.integrate(2*k*x, (x, 0, upper))
    cube_coefficient = (group + 1) % 4 + 2
    f = k*x*x*y + cube_coefficient*y**3
    assert sp.simplify(answer(questions[2]) - sp.diff(f, x)) == 0
    assert sp.simplify(answer(questions[3]) - sp.diff(f, y)) == 0
    assert sp.simplify(answer(questions[4]) - sp.diff(k*x*x*y*y, x, y)) == 0
    stationary = answer(questions[5])
    assert sp.diff(x*x - 2*k*x, x).subs(x, stationary) == 0
    assert answer(questions[6]) == sp.binomial(k+2, 2)

# Check the nontrivial antiderivatives and decompositions used in worked lessons.
checks = [
    (x**5/5, x**4),
    ((3*x+2)**5/15, (3*x+2)**4),
    (sp.exp(x)*(x-1), x*sp.exp(x)),
    (sp.exp(3*x)*(x*x/3-2*x/9+sp.Rational(2,27)), x*x*sp.exp(3*x)),
    (sp.exp(x)*(sp.cos(x)+sp.sin(x))/2, sp.exp(x)*sp.cos(x)),
    (sp.exp(x)*(x*x-2*x+2), x*x*sp.exp(x)),
    (-x*x*sp.cos(x)+2*x*sp.sin(x)+2*sp.cos(x), x*x*sp.sin(x)),
]
for antiderivative, integrand in checks:
    assert sp.simplify(sp.diff(antiderivative, x) - integrand) == 0
assert sp.simplify(1/x - 1/(x+1) - 1/(x+1)**2 - 1/(x*(x+1)**2)) == 0
assert sp.simplify((3*x+2)*(x-2) - (3*x*x-4*x-4)) == 0
print('84 parameterised answers and 9 worked-example identities independently verified with SymPy.')
