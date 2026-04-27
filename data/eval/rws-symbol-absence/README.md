# RWS Symbol-Absence Benchmark

JSONL rows in this directory should verify that the vision stack can say when a symbol is not visible, instead of turning expected Rider knowledge into uploaded-image claims.

Required shape:

```json
{"eval_id":"rws_absence_0031","image":"three_of_swords_clean.jpg","expected_card":"Three of Swords","orientation":"upright","absence_negatives":["animal","cup","water"],"ideal_absence_answer":"No animal is visible."}
```

Use this benchmark to compute `absentSymbolFalsePositiveRate` and `symbolHallucinationRate`.
