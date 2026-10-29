"""Build the reviewed MTH 101 bundle from the two supplied PDFs."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "supabase/content/explanatory-maths-20261025/mth-101.json"
OUT = ROOT / "supabase/content/mth-101-real-numbers-20261029.json"
SOURCE = Path(r"C:\Users\DELL\AppData\Local\Packages\5319275A.WhatsAppDesktop_cv1g1gvanyjgm\LocalState\sessions\3DE16AF2B7B041F59923671DBECF679C71D4531A\transfers\2026-44\Real numbers.pdf")

data = json.loads(BASE.read_text(encoding="utf-8"))
digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
data["materials"].append({"sha256": digest, "object_key": f"course-materials/{digest}.pdf", "filename": SOURCE.name, "bytes": SOURCE.stat().st_size})

# Each item has a concept, a fully explained calculation, and two distinct checks.
topics = [
 ("Real-number families", "A real number has a place on the number line. Natural numbers start at 1; whole numbers add 0; integers also include negatives. Rational numbers are ratios of integers with a nonzero denominator. Irrational numbers are real numbers that cannot be written as such a ratio. A number can belong to several nested families.", "Classify -4 using the smallest standard family and every larger family it belongs to.", [("-4 is an integer", "Negative whole-number opposites are integers; -4 is not a whole or natural number."), ("-4 = -4/1", "A quotient of two integers with denominator 1 is rational."), ("integers ⊂ rational numbers ⊂ real numbers", "Every rational number has a position on the real number line.")], "-4 is an integer, a rational number, and a real number.", ("Which is the smallest standard family containing 0?", ["Natural numbers", "Whole numbers", "Irrational numbers", "Negative integers"], "B", "Natural numbers in this course begin at 1, so 0 is excluded. Whole numbers are 0, 1, 2, ...; thus 0 belongs to the whole-number family. It is also an integer, rational (0/1), and real, but whole is the smallest listed family."), ("Why is -4 rational?", ["It is positive", "It has no decimal form", "It equals -4/1", "It is a natural number"], "C", "The definition of rational requires a ratio of integers with nonzero denominator. Write -4 as -4/1: both -4 and 1 are integers and the denominator is not zero. Its negative sign does not make it irrational."), "Real numbers.pdf, pages 1–4"),
 ("Rational and irrational numbers", "A rational decimal terminates or eventually repeats, because division by a nonzero integer denominator leaves only finitely many possible remainders. An irrational decimal never terminates and never becomes periodic. Roots of perfect squares are rational; roots such as √2 and √50 are irrational. A calculator's short display cannot prove irrationality.", "Classify √50 and 2/3.", [("√50 = √(25×2) = 5√2", "Factor out the perfect square 25. Since √2 is irrational, multiplying it by nonzero rational 5 leaves it irrational."), ("2/3 = 0.666...", "The digit 6 repeats indefinitely; the ratio of two integers is rational by definition.")], "√50 is irrational; 2/3 is rational.", ("Which number is irrational?", ["√64", "0.125", "√2", "0.666..."], "C", "√64 = 8, which is an integer. 0.125 = 1/8 terminates, and 0.666... = 2/3 repeats; all are rational. √2 cannot be expressed as a ratio of integers, so it is irrational."), ("Is 0.454545... rational?", ["No; it has infinitely many digits", "Yes; its repeating block makes it rational", "No; only integers are rational", "Yes; because it equals 0"], "B", "The decimal repeats the block 45. Set x = 0.454545...; then 100x = 45.454545..., so 99x = 45 and x = 45/99 = 5/11. That ratio proves it is rational despite having infinitely many digits."), "Real numbers.pdf, pages 5–6"),
 ("Comparing real numbers", "Convert fractions and percentages to comparable decimals, then use the number line. For positives, the larger decimal is farther right. For negatives, the one with the larger absolute size is farther left and therefore smaller. Restore the original notation in the final answer.", "Order 3/4, 79%, 0.075, and 15/16 from least to greatest.", [("3/4 = 0.75; 79% = 0.79", "Divide 3 by 4 and divide 79 by 100 to put both in decimal form."), ("15/16 = 0.9375", "Divide numerator by denominator; 0.075 already is a decimal."), ("0.075 < 0.75 < 0.79 < 0.9375", "Align decimal places and compare from left to right.")], "0.075, 3/4, 79%, 15/16.", ("Which is least: -0.75, -2/3, 0.2, 65%?", ["-0.75", "-2/3", "0.2", "65%"], "A", "-2/3 ≈ -0.6667 and 65% = 0.65. Both negative values lie left of the positive values. Of the negatives, -0.75 lies farther left than -0.6667, so -0.75 is least."), ("Order 0.075, 3/4, 79% from least to greatest.", ["79%, 3/4, 0.075", "0.075, 79%, 3/4", "0.075, 3/4, 79%", "3/4, 0.075, 79%"], "C", "Express everything as decimals: 0.075 remains 0.075, 3/4 = 0.75, and 79% = 0.79. Comparing 0.075, 0.750, and 0.790 gives that exact increasing order."), "Real numbers.pdf, pages 7–9"),
 ("Properties of real numbers", "Commutative laws swap the order of two terms; associative laws regroup three terms; identity laws leave a number unchanged when adding 0 or multiplying by 1. These laws apply to addition and multiplication. Subtraction and division do not generally have commutative or associative laws.", "Identify the property in (2 + 3) + 4 = 2 + (3 + 4).", [("(2 + 3) + 4", "The order of the numbers is 2, 3, 4."), ("2 + (3 + 4)", "The same numbers stay in the same order; only parentheses move."), ("(a + b) + c = a + (b + c)", "This general rule is the associative property of addition, so the given equation is an instance of it.")], "Associative property of addition.", ("Which property explains 6 + 4 = 4 + 6?", ["Associative addition", "Commutative addition", "Additive identity", "Multiplicative identity"], "B", "The two addends exchange positions but their grouping does not change. The commutative property states a + b = b + a, so 6 + 4 = 4 + 6 is commutative addition."), ("What is the additive identity?", ["1", "-1", "0", "Any integer"], "C", "The additive identity e satisfies a + e = a for every real a. Zero does this because a + 0 = a; 1 instead is the multiplicative identity because a × 1 = a."), "Real numbers.pdf, pages 10–11"),
 ("Order of operations", "Evaluate grouping symbols first, then powers, then multiplication and division from left to right, then addition and subtraction from left to right. Multiplication does not automatically precede division, and addition does not automatically precede subtraction. Parentheses may contain the same full order again.", "Evaluate 5[(3 + 12) - 2(4)].", [("3 + 12 = 15; 2(4) = 8", "Finish the inner sum and multiplication inside the bracket first."), ("5[15 - 8] = 5[7]", "Subtract within the bracket before multiplying by the outer 5."), ("5 × 7 = 35", "The remaining operation gives the value.")], "35.", ("Evaluate 18 ÷ 3 × 2.", ["3", "12", "1", "18"], "B", "Division and multiplication have equal priority, so work left to right: 18 ÷ 3 = 6, then 6 × 2 = 12. Dividing by 3 × 2 as though it were grouped would answer a different expression."), ("Evaluate 5[(3 + 12) - 2(4)].", ["35", "25", "7", "75"], "A", "Inside the bracket, 3 + 12 = 15 and 2(4) = 8. Subtract to obtain 15 - 8 = 7. The outside 5 then multiplies the whole bracket: 5 × 7 = 35."), "Real numbers.pdf, pages 12–13"),
 ("Variables and expressions", "A variable is a letter standing for an unknown or changing quantity. A coefficient multiplies a variable: 5a means 5 × a. To evaluate an expression, substitute each supplied value, keep parentheses around negative substitutions, and apply operation order. Phrases such as 'more than' and 'less than' require attention to order.", "Evaluate 5a + bc - c when a = 4, b = 2, c = 3.", [("5(4) + (2)(3) - 3", "Replace each variable with its stated value; adjacent symbols mean multiplication."), ("20 + 6 - 3", "Perform the two products before addition or subtraction."), ("26 - 3 = 23", "Addition and subtraction proceed left to right.")], "23.", ("Evaluate 5a + bc - c for a=4, b=2, c=3.", ["20", "23", "26", "29"], "B", "Substitute the values: 5(4) + (2)(3) - 3. Multiply first to get 20 + 6 - 3, then add and subtract from left to right: 26 - 3 = 23."), ("Which expression means eight more than Rachel's score r?", ["8r", "8 - r", "r + 8", "r - 8"], "C", "Start with Rachel's score r. 'Eight more than' asks you to add 8 to that score, giving r + 8. Multiplication 8r means eight times her score, while subtraction makes it smaller."), "Real numbers.pdf, pages 14–17"),
 ("Solving one-step equations", "An equation is balanced when both sides remain equal. Use the inverse of the operation attached to the variable on both sides: undo addition with subtraction and undo multiplication with division. Always substitute the proposed solution into the original equation to check it.", "Solve x + 4 = 17.", [("x + 4 - 4 = 17 - 4", "Subtract 4 from both sides, preserving equality and canceling the added 4."), ("x = 13", "Simplify both sides after cancellation."), ("13 + 4 = 17", "Substitution reproduces the right side, so the solution checks.")], "x = 13.", ("Solve x + 4 = 17.", ["x = 21", "x = 13", "x = 4", "x = 17"], "B", "Subtract 4 from both sides: x + 4 - 4 = 17 - 4, so x = 13. Check in the original equation: 13 + 4 = 17, which is true."), ("Solve n/4 = 7.", ["n = 7/4", "n = 11", "n = 28", "n = 3"], "C", "Multiplication by 4 is the inverse of division by 4. Multiply both sides of n/4 = 7 by 4 to get n = 28. Check: 28/4 = 7, so the equation is satisfied."), "Real numbers.pdf, pages 18–19"),
 ("Equations with rational numbers", "Fraction equations use the same balance rule as integer equations. Add or subtract fractions by first using a common denominator. To undo multiplication by a nonzero fraction, multiply by its reciprocal. Keep negative signs with the fraction and check the result in the original equation.", "Solve x - 5/6 = 7/8.", [("x = 7/8 + 5/6", "Add 5/6 to both sides to isolate x."), ("x = 21/24 + 20/24", "The least common denominator of 8 and 6 is 24; rewrite both fractions."), ("x = 41/24", "Add numerators while keeping the common denominator."), ("41/24 - 20/24 = 21/24 = 7/8", "Substitute 41/24 and verify the original equation.")], "x = 41/24.", ("Solve x - 5/6 = 7/8.", ["x = 2/14", "x = 41/24", "x = 1/24", "x = 12/48"], "B", "Add 5/6 to each side: x = 7/8 + 5/6. Convert to denominator 24: 7/8 = 21/24 and 5/6 = 20/24. Thus x = 41/24. Checking, 41/24 - 5/6 = 41/24 - 20/24 = 21/24 = 7/8."), ("Solve (-2/3)x = 5/6.", ["x = 5/4", "x = -5/4", "x = -5/9", "x = 5/9"], "B", "Multiply both sides by the reciprocal -3/2: x = (5/6)(-3/2) = -15/12 = -5/4. Check: (-2/3)(-5/4) = 10/12 = 5/6, so the signs and fraction are correct."), "Real numbers.pdf, pages 20–21"),
]

lessons=[]
questions=[]
math_steps = {
  1:[r'-4\in\mathbb{Z}',r'-4=\frac{-4}{1}\in\mathbb{Q}',r'\mathbb{Z}\subset\mathbb{Q}\subset\mathbb{R}'],
  2:[r'\sqrt{50}=\sqrt{25\cdot2}=5\sqrt2',r'\frac23=0.666\ldots'],
  3:[r'\frac34=0.75,\quad79\%=0.79',r'\frac{15}{16}=0.9375',r'0.075<0.75<0.79<0.9375'],
  4:[r'(2+3)+4',r'2+(3+4)',r'(a+b)+c=a+(b+c)'],
  5:[r'3+12=15,\quad2(4)=8',r'5[15-8]=5[7]',r'5\cdot7=35'],
  6:[r'5(4)+(2)(3)-3',r'20+6-3',r'26-3=23'],
  7:[r'x+4-4=17-4',r'x=13',r'13+4=17'],
  8:[r'x=\frac78+\frac56',r'x=\frac{21}{24}+\frac{20}{24}',r'x=\frac{41}{24}',r'\frac{41}{24}-\frac{20}{24}=\frac{21}{24}=\frac78'],
}
for i,(title,concept,problem,steps,answer,qa,qb,reference) in enumerate(topics,1):
    key=f"mth101-real-20261029-{i:02d}"
    def question(q, suffix):
        prompt, choices, correct, explanation=q
        return {"logical_question_key":f"{key}-{suffix}","pool":"learning","usage":["review","practice","mock"],"prompt":prompt,"options":[{"label":chr(65+j),"body":choice} for j,choice in enumerate(choices)],"correct_option":correct,"explanation":explanation,"course_code":"MTH 101","difficulty":"beginner" if i<5 else "intermediate","source_reference":reference}
    questions.extend([question(qa,"a"),question(qb,"b")])
    explanation="\n\n".join(f"{calc}. {why}" for calc,why in steps)
    lesson={"logical_key":key,"source_sha256":digest,"title":title,"objective":f"Explain {title.lower()}, apply the method, and justify each step.","estimated_minutes":9,"blocks":[
        {"type":"heading","text":"Understand the concept"},{"type":"paragraph","text":concept},
        {"type":"heading","text":"Worked example"},{"type":"worked_example","title":"Follow every step","problem":problem,"steps":[{"calculation":math_steps[i][j],"explanation":e} for j,(_,e) in enumerate(steps)],"answer":answer,"check":{"calculation":math_steps[i][-1],"explanation":"The final calculation agrees with the starting question. For equations, substitute the solution into the original equation."}},
        {"type":"heading","text":"Review the whole lesson"},{"type":"paragraph","text":"First explain the rule in your own words. Then solve both questions without looking at the answer, and compare each intermediate step with the worked solution above."},
        {"type":"checkpoint","question":qa[0],"options":qa[1],"correct_index":ord(qa[2])-65,"explanation":qa[3]},
        {"type":"checkpoint","question":qb[0],"options":qb[1],"correct_index":ord(qb[2])-65,"explanation":qb[3]},
        {"type":"callout","tone":"example","title":"Worked result","text":explanation+"\n\nAnswer: "+answer},
        {"type":"heading","text":"Recap"},{"type":"paragraph","text":concept}],"source_reference":reference+f" [source SHA-256 {digest[:12]}]"}
    lessons.append(lesson)

data["lessons"] = lessons + data["lessons"]
data["questions"] = questions + data["questions"]
# The admin import path publishes teaching content without uploading the PDFs.
# Preserve the established six lesson slots and add one new topic module.
lesson_rows=[]
for i,lesson in enumerate(data['lessons'][:8]):
    row={k:v for k,v in lesson.items() if k!='source_sha256'}
    if i<8:
        row.update(course_code='MTH 101',module_title='Real Number System',module_position=4,lesson_position=i+1)
    checks=[b for b in lesson['blocks'] if b.get('type')=='checkpoint']
    row['flashcards']=[{'front':b['question'][:500],'back':b['explanation'][:520],'tag':'section'} for b in checks[:3]]
    lesson_rows.append(row)
questions_rows=questions
for name,rows in [('lessons',lesson_rows),('questions',questions_rows)]:
    path=OUT.with_name(f'mth-101-real-numbers-20261029-{name}.json')
    path.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{path}: {len(rows)} rows')

# Reuse the original MTH 101 source already verified in private storage to
# publish the complete question bank through the working content sync path.
question_sync=json.loads(BASE.read_text(encoding='utf-8'))
question_sync['questions'] += questions
sync_path=OUT.with_name('mth-101-questions-sync-20261029.json')
sync_path.write_text(json.dumps(question_sync,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{sync_path}: {len(question_sync["questions"])} questions')
