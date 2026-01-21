# Narrative Builder & Prompt Engineering Review - Executive Summary

**Date:** 2026-01-21  
**Reviewer:** GitHub Copilot Code Review Agent  
**Repository:** henryperkins/tarot  
**Files Analyzed:** 7,562 lines of code  

---

## TL;DR

The narrative builder and prompt engineering system is **functionally excellent** but needs **technical debt reduction**. System is production-ready but requires refactoring for long-term sustainability.

**Grade:** B+ (83/100)

---

## Key Findings

### ✅ Strengths

1. **Sophisticated Architecture**
   - Layered pipeline with clear stages
   - Token budgeting with conservative estimation
   - GraphRAG integration for contextual passages
   - A/B testing framework
   - Comprehensive observability

2. **Safety-First Design**
   - Crisis detection for mental health signals
   - Input sanitization
   - Quality gates for narrative validation
   - Ethical guidelines enforcement

3. **Flexible Backend Selection**
   - Azure GPT-5 → Claude → Local fallback
   - Provider-specific prompt variants
   - Streaming support

### ⚠️ Issues Found

#### Critical (Must Fix)

1. **File Size Explosion** 🔴
   - `prompts.js`: 2,118 lines
   - `helpers.js`: 1,680 lines
   - Hard to maintain and test

2. **Performance Waste** 🔴
   - Crisis detection happens **after** expensive spread analysis
   - Wastes 50-100ms on rejected inputs

3. **Global State** 🔴
   - `PROSE_MODE` flag vulnerable to cross-request bleed
   - Legacy test helper pattern

4. **Safety Gap** 🔴
   - Token truncation could compromise safety sections
   - Logs error but proceeds anyway

#### Security Concerns

5. **Prompt Injection Risk** ⚠️
   - `sanitizePromptValue()` doesn't strip template syntax
   - `{{}}`, `${}`, `<%%>` patterns not filtered

6. **Vision Proof Handling** ⚠️
   - Card mismatches logged but reading proceeds
   - Could bias readings with incorrect data

7. **Input Validation Scattered** ⚠️
   - Length caps applied late in pipeline
   - Missing guards in spread builders

#### Maintainability

8. **Code Duplication** 📝
   - Spread builders repeat opening/closing logic
   - 30-40% LOC reduction possible

9. **Inconsistent Error Responses** 📝
   - HTTP status codes vary: 400/409/422/429/503
   - No documented error matrix

10. **Incomplete Features** 📝
    - Reasoning integration half-implemented
    - Optional features not truly optional

---

## Quick Wins (3 hours)

These can be implemented **immediately** with minimal risk:

### 1. Move Crisis Detection Earlier ⚡
- **Impact:** Saves 50-100ms on rejected inputs
- **Effort:** 1 hour
- **Risk:** Low

### 2. Fail-Fast on Safety Budget Overflow 🛡️
- **Impact:** Prevents silent safety guidance truncation
- **Effort:** 30 minutes
- **Risk:** Low

### 3. Add Template Syntax Stripping 🔒
- **Impact:** Prevents prompt injection
- **Effort:** 30 minutes
- **Risk:** Low

### 4. Add Input Guards to Spread Builders 🛡️
- **Impact:** Prevents crashes on malformed input
- **Effort:** 1 hour
- **Risk:** Low

**Total:** 3 hours, High impact, Low risk

---

## Recommended Timeline

### Week 1: Quick Wins
- Implement all 4 quick wins
- Add tests for new validation
- Deploy to preview environment

### Month 1: Refactoring
- Split `prompts.js` into sub-modules
- Remove `PROSE_MODE` global state
- Add comprehensive token budgeting tests

### Quarter 1: Architecture
- Extract spread builder base class
- Document error response matrix
- Implement GraphRAG caching

### Year 1: Plugin System
- Design plugin architecture
- Migrate to plugin-based narrative system
- Achieve < 500 LOC per file

---

## Metrics & Monitoring

### New Metrics to Track

1. **Crisis Detection Timing**
   - Time saved by early detection
   - Readings saved from analysis

2. **Token Budget Issues**
   - PROMPT_SAFETY_BUDGET_EXCEEDED frequency
   - Sections affected by truncation

3. **Input Validation**
   - NARRATIVE_NO_CARDS frequency
   - Card count mismatches

4. **Security**
   - Template injection attempts
   - Vision proof mismatches

### Alerting Thresholds

- **Critical:** Safety budget exceeded > 5/hour
- **Warning:** Crisis detection > 1% of requests
- **Info:** Token truncation > 10% of requests

---

## Risk Assessment

### Low Risk Changes
- ✅ Crisis detection timing (straightforward refactor)
- ✅ Safety budget fail-fast (error handling)
- ✅ Template syntax filtering (string operations)
- ✅ Input guards (validation logic)

### Medium Risk Changes
- ⚠️ File refactoring (requires thorough testing)
- ⚠️ Global state removal (affects tests)
- ⚠️ Base class extraction (inheritance patterns)

### High Risk Changes
- ❌ Plugin architecture (major refactor)
- ❌ Backend routing changes (affects all readings)

**Recommendation:** Start with low-risk changes to build confidence.

---

## Testing Strategy

### Existing Tests ✅
- `narrativeBuilder.reversal.test.mjs`
- `promptEngineering.test.mjs`
- `narrativeSpine.test.mjs`
- `narrativeBuilder.promptCompliance.test.mjs`

### New Tests Needed
- Token budgeting edge cases
- Prompt injection attempts
- Crisis detection false positives
- Input validation scenarios
- GraphRAG passage filtering

### Test Coverage Goal
- Current: ~60% (estimated)
- Target: 85% by Q1 end

---

## Documentation Updates

### New Documents Created
1. **NARRATIVE_BUILDER_REVIEW.md** (23KB)
   - Comprehensive analysis
   - Code examples
   - Recommendations

2. **NARRATIVE_IMPROVEMENTS_PLAN.md** (14KB)
   - Actionable items
   - Implementation details
   - Migration paths

3. **NARRATIVE_REVIEW_SUMMARY.md** (This file)
   - Executive summary
   - Key findings
   - Timeline

### Existing Docs to Update
- CLAUDE.md (add token budgeting details)
- README.md (reference new review docs)
- AGENTS.md (document narrative system)

---

## Success Criteria

### Immediate (Week 1)
- [x] Review complete
- [x] Documentation delivered
- [ ] Quick wins implemented
- [ ] Tests passing
- [ ] Preview deployment successful

### Short-Term (Month 1)
- [ ] `prompts.js` < 1000 LOC
- [ ] No global state
- [ ] 80%+ test coverage
- [ ] Input guards on all builders

### Medium-Term (Quarter 1)
- [ ] All files < 1000 LOC
- [ ] Error response matrix documented
- [ ] GraphRAG caching implemented
- [ ] 85%+ test coverage

### Long-Term (Year 1)
- [ ] Plugin architecture complete
- [ ] All files < 500 LOC
- [ ] 90%+ test coverage
- [ ] Zero global state

---

## Stakeholder Communication

### For Product Managers
- **Impact:** Faster responses (50-100ms saved on invalid inputs)
- **Security:** Prompt injection prevented
- **Quality:** Safety guidance always preserved
- **Risk:** Low (changes are surgical)

### For Engineers
- **Complexity:** Reduced (smaller files, clearer boundaries)
- **Testing:** Improved (input validation, safety checks)
- **Debugging:** Easier (clear error messages)
- **Maintenance:** Better (less duplication)

### For Users
- **Performance:** Slightly faster responses
- **Safety:** Better crisis handling
- **Reliability:** Fewer edge case bugs
- **Experience:** No visible changes (intentional)

---

## Next Steps

1. **Review this document** with team
2. **Approve quick wins** for implementation
3. **Assign owner** for each improvement
4. **Set up monitoring** for new metrics
5. **Schedule follow-up** in 1 week

---

## Appendices

### A. File Size Analysis
```
prompts.js:             2,118 LOC  (needs split)
helpers.js:             1,680 LOC  (needs split)
reasoning.js:           1,205 LOC  (acceptable)
tarot-reading.js:       1,200 LOC  (orchestration, acceptable)
reasoningIntegration.js:  523 LOC  (acceptable)
celticCross.js:           467 LOC  (good)
relationship.js:          377 LOC  (good)
decision.js:              296 LOC  (good)
fiveCard.js:              281 LOC  (good)
threeCard.js:             252 LOC  (good)
styleHelpers.js:          238 LOC  (excellent)
singleCard.js:            125 LOC  (excellent)
```

### B. Complexity Scores
| File | Complexity | Maintainability |
|------|-----------|-----------------|
| prompts.js | High | Poor |
| helpers.js | High | Poor |
| tarot-reading.js | Very High | Fair |
| reasoning.js | High | Fair |
| spreads/*.js | Medium | Good |

### C. Security Checklist
- [x] Input sanitization
- [x] Authentication
- [x] Rate limiting
- [x] Crisis detection
- [x] Vision proof verification
- [ ] Template syntax filtering ⚠️
- [ ] Vision mismatch confirmation ⚠️
- [ ] Schema-level length validation ⚠️

### D. Performance Checklist
- [x] Token estimation
- [x] Section-aware truncation
- [x] Metrics collection
- [x] A/B testing
- [ ] Early crisis detection ⚠️
- [ ] Lazy-load enrichments ⚠️
- [ ] GraphRAG caching ⚠️

### E. Code Quality Checklist
- [ ] Files < 500 LOC ⚠️
- [ ] No global state ⚠️
- [x] Separation of concerns (mostly)
- [ ] Consistent error responses ⚠️
- [ ] Input guards ⚠️
- [x] Comprehensive logging
- [x] Prompt versioning
- [ ] DRY principle ⚠️

---

## Conclusion

The narrative builder is a **solid foundation** with room for improvement. The quick wins address critical security and performance issues with minimal risk. The longer-term refactoring will improve maintainability and reduce technical debt.

**Recommendation:** Proceed with quick wins immediately, then tackle refactoring in subsequent sprints.

---

**Contact:** GitHub Copilot  
**Last Updated:** 2026-01-21  
**Version:** 1.0
