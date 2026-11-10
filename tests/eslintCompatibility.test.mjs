import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();

test('React rules still report JSX defects through the ESLint compatibility bridge', async () => {
  const [result] = await eslint.lintText(`
    import { memo } from 'react';
    export default memo(() => <div class="example">{[<span />]}</div>);
  `, { filePath: 'src/components/LintCompatibilityFixture.jsx' });

  assert.equal(result.fatalErrorCount, 0);
  for (const ruleId of ['react/display-name', 'react/no-unknown-property', 'react/jsx-key']) {
    assert.ok(result.messages.some(message => message.ruleId === ruleId && message.severity === 2), ruleId);
  }
});

test('hooks and JSX variable usage remain enforced with ESLint 10', async () => {
  const [result] = await eslint.lintText(`
    import { useState } from 'react';
    function Child() { return <span />; }
    export function Example({ enabled }) {
      if (enabled) useState(0);
      return <Child />;
    }
  `, { filePath: 'src/components/LintCompatibilityFixture.jsx' });

  assert.equal(result.fatalErrorCount, 0);
  assert.ok(result.messages.some(message => message.ruleId === 'react-hooks/rules-of-hooks' && message.severity === 2));
  assert.ok(!result.messages.some(message => message.ruleId === 'no-unused-vars'));
});
