# Explanatory maths

Reviewed revisions for MTH 101 (6 lessons, 30 questions), MTH 102 (5 lessons, 10 questions), and MTH 201 (18 lessons, 138 questions). Original course codes, logical keys, source references and hashes, question labels, answer keys, and pool assignments are retained. The inventory records every revised lesson. `notation-review.json` records the explicit original expressions and their display markup; it performs no algebraic simplification.

Lessons follow foundations and symbols → concept → worked example → guided practice → independent practice → recap. Every worked step contains a complete calculation followed by the reason for that step. Essential steps are always visible. Results include a verification and relevant domain restrictions. Question feedback uses separate display calculations and explanatory paragraphs.

## Authoring

- Inline maths in string fields: `\(x^2\)`. A separate calculation: `\[\frac{x+1}{2}=4\]` or `$$...$$`. Double every backslash inside JSON strings.
- Equation block: `{"type":"equation","expression":"x^2","reading":"x squared"}`. `reading` is optional; native MathML supplies accessible maths when omitted.
- Worked example: `{"type":"worked_example","title":"Solve","problem":"Find x.","steps":[{"calculation":"2x+3=11","explanation":"Start from the given equation."},{"calculation":"2x=8","explanation":"Subtract three from both sides to preserve equality."},{"calculation":"x=4","explanation":"Divide both sides by two to isolate x."}],"answer":"x=4","check":{"calculation":"2(4)+3=11","explanation":"Substitution satisfies the original equation."}}`.
- Use grouped exponents, complete fraction numerators and denominators, and approximation signs where appropriate. Never weave prose between parts of one calculation. Existing plain strings still work; clearly grouped legacy powers receive superscript typography. Code blocks are unchanged. Ambiguous plain-text expressions are not automatically reinterpreted.
- Malformed TeX displays an explicit review notice rather than silently changing its meaning. Review and correct that notice before publication. Untrusted HTML and KaTeX URL/HTML commands are not enabled.

## Verify and release

1. Install locked dependencies and run `node scripts/test-maths.cjs`. Optional `PGLITE_MODULE` enables migration/validator checks; optional `PLAYWRIGHT_MODULE` enables browser checks after a production build. `BROWSER_CHANNEL` defaults to `msedge`; screenshots go to ignored `.maths-verification/`.
2. With Python and SymPy, run `python scripts/check-maths-answers.py` for independent mathematical checks.
3. Deploy the web renderer before publishing new block types. Apply migration `20261029001200_explanatory_maths.sql`; it extends validation and the existing teaching-example check without changing publication permissions.
4. At `/admin/content-sync`, dry-run each course JSON bundle and review the report. Synchronise as drafts, review the rendered lessons, then publish using the existing admin workflow. This requires administrator access and the existing private source objects in R2.

A code push does not apply the database migration or publish these bundles. The bundled guest MTH 102 explanations take effect with the web deployment. No live student attempts or answer keys are rewritten by the code change.

Automated checks cover all 29 lessons and 178 questions, malformed input, HTML safety, backward compatibility, visible worked steps, keyboard access to long equations, MathML output, and page widths 320/390/768/1440. Actual screen-reader speech and authenticated hosted publication require a deployed environment and a human accessibility check.
