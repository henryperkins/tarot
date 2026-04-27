# RWS Hard-Negative Benchmark

JSONL rows in this directory should pair visually confusable Rider-Waite-Smith cards so routing and metrics can measure similar-card errors.

Required shape:

```json
{"eval_id":"rws_hard_negative_0001","image":"high_priestess_clean.jpg","expected_card":"The High Priestess","orientation":"upright","hard_negatives":["Justice","The Hierophant"],"distinguishing_features":["scroll","veil","crescent moon"]}
```

Images should be public-domain RWS crops or internally licensed review fixtures. Do not include user uploads.
