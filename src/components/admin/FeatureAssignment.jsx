import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CaretRight } from '@phosphor-icons/react';
import { changePrimary, displayValue, hasRetiredModel, modelLabel, providerLabel } from '../../lib/adminAiConfiguration.js';

export function FeatureList({ features, inventory, selected, dirty, onSelect }) {
  function row(feature) {
    const step = feature.policy.primary;
    return (
      <button type="button" className="ai-feature-row" key={feature.id} onClick={() => onSelect(feature.id)}
        aria-current={feature.id === selected ? 'true' : undefined}>
        <span><strong>{feature.label}</strong>
          {selected === feature.id && dirty && <span className="ai-chip">Edited</span>}
          <small>{feature.policyStatus === 'migration_required' ? 'Catalog migration required'
            : providerLabel(feature, step.providerId) + ' / ' + modelLabel(feature, step)}</small>
          {feature.policyStatus === 'repair_required' && <small>Model replacement required</small>}
        </span>
        <CaretRight size={15} aria-hidden="true" />
      </button>
    );
  }
  const background = features.filter(feature => feature.group === 'background');
  return (
    <aside className="ai-features" aria-label="Feature assignments">
      <h2>Features</h2>
      <div className="ai-feature-list">{features.filter(feature => feature.group !== 'background').map(row)}</div>
      <details open={background.some(feature => feature.id === selected) || undefined}>
        <summary>Background tasks <span className="ai-chip">{background.length}</span><CaretRight size={15} /></summary>
        <div className="ai-feature-list">{background.map(row)}</div>
      </details>
      <details>
        <summary>Vision, embeddings &amp; media<CaretRight size={15} /></summary>
        <dl className="ai-inventory">
          {inventory.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}
            {item.status && <small className="block ai-meta">{item.status}</small>}</dd></div>)}
        </dl>
      </details>
    </aside>
  );
}

function replaceModel(step, provider, modelId) {
  const model = provider.models.find(option => option.id === modelId);
  const next = { providerId: step.providerId, modelId };
  if (model.efforts.includes(step.reasoningEffort)) next.reasoningEffort = step.reasoningEffort;
  return next;
}

export function PrimaryFields({ feature, policy, onChange, readOnly }) {
  const step = policy.primary;
  const provider = feature.providers.find(option => option.id === step.providerId);
  const model = provider?.models.find(option => option.id === step.modelId);
  const eligible = feature.providers.filter(option => option.primaryEligible || option.id === step.providerId);
  const saved = feature.policy.primary;
  const alias = feature.effortAlias || (!saved.reasoningEffort && feature.deploymentEffortAlias);

  function changeModel(modelId) {
    onChange({ ...policy, primary: replaceModel(step, provider, modelId) });
  }

  function changeEffort(value) {
    const primary = { ...step };
    if (value) primary.reasoningEffort = value;
    else delete primary.reasoningEffort;
    onChange({ ...policy, primary });
  }

  return (
    <section className="ai-section" aria-label="Primary model">
      <h3>Primary model</h3>
      {hasRetiredModel(feature, policy) && <p className="ai-meta">This draft contains retired models. Choose replacements and save to apply the repair.</p>}
      <div className="ai-field-grid">
        <label>Provider
          <select value={step.providerId} disabled={readOnly || eligible.length < 2}
            onChange={event => onChange(changePrimary(policy, eligible.find(option => option.id === event.target.value)))}>
            {eligible.map(option => <option key={option.id} value={option.id}
              disabled={!option.configured && option.id !== saved.providerId}>{option.label}{option.configured ? '' : ' (unconfigured)'}</option>)}
          </select>
          {saved.providerId !== step.providerId && <small>Saved: {providerLabel(feature, saved.providerId)}</small>}
        </label>
        <label>Model
          <select value={step.modelId} disabled={readOnly || !provider?.models.length} onChange={event => changeModel(event.target.value)}>
            {!model && step.modelId && <option value={step.modelId} disabled>{step.modelId} (retired)</option>}
            {provider?.models.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          {saved.modelId !== step.modelId && <small>Saved: {modelLabel(feature, saved)}</small>}
        </label>
        {Boolean(model?.efforts.length) && <label>Reasoning effort
          <select value={step.reasoningEffort || ''} disabled={readOnly} data-edited={saved.reasoningEffort !== step.reasoningEffort}
            onChange={event => changeEffort(event.target.value)}>
            <option value="">Task default</option>
            {model.efforts.map(effort => <option key={effort} value={effort}>{displayValue(effort)}</option>)}
          </select>
          {saved.reasoningEffort !== step.reasoningEffort && <small>Saved: {displayValue(saved.reasoningEffort)}</small>}
          {alias && <small>{alias.source === 'revision' ? 'Saved as ' : 'Deployment default '}
            {displayValue(alias.original)} · effective {displayValue(alias.effective)}</small>}
        </label>}
      </div>
      {feature.gatePolicy && <div className="ai-meta">
        <h4>Delivery policy</h4>
        <p>Model grading is {feature.gatePolicy.gradingEnabled ? 'enabled' : 'disabled'}. {feature.gatePolicy.globalEnabled
          ? 'Every reading is checked before delivery.' : 'Ordinary readings can proceed without model grading before delivery.'}</p>
        {feature.gatePolicy.globalEnabled && <p>{feature.gatePolicy.failureMode === 'open'
          ? 'If grading is unavailable, ordinary readings can be delivered after local checks pass.'
          : 'If grading is unavailable, delivery is blocked.'}</p>}
        <p>Restricted topics and unsupported languages require a complete assessment. If grading is unavailable, delivery is blocked for those readings.</p>
      </div>}
    </section>
  );
}

export function FallbackOrder({ feature, policy, onChange, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const toggle = useRef(null);
  const choices = policy.fallbacks;
  if (!choices.length) return null;
  const movable = step => feature.id === 'readings' && step?.modelId;
  function move(index, offset, button) {
    const next = choices.slice();
    const [step] = next.splice(index, 1);
    next.splice(index + offset, 0, step);
    onChange({ ...policy, fallbacks: next });
    // At either boundary the pressed direction becomes disabled. Keep keyboard
    // focus with the moved provider on its remaining available direction.
    const controls = button.parentElement;
    requestAnimationFrame(() => {
      if (button.disabled) controls?.querySelector('button:enabled')?.focus();
    });
    setAnnouncement(providerLabel(feature, step.providerId) + ' is now fallback ' + (index + offset + 1) + '.');
  }
  return (
    <section className="ai-section" aria-label="Fallback order">
      <div className="ai-line"><h3>Fallback order</h3>
        {choices.filter(movable).length > 1 && !readOnly && <button className="ai-text-action" type="button" ref={toggle}
          aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Edit order'}</button>}
      </div>
      <ol className="ai-fallbacks" onKeyDown={event => {
        if (editing && event.key === 'Escape') { setEditing(false); toggle.current?.focus(); }
      }}>
        {choices.map((step, index) => {
          const label = providerLabel(feature, step.providerId);
          const provider = feature.providers.find(option => option.id === step.providerId);
          const retired = feature.retiredModels?.find(item => item.providerId === step.providerId);
          // A conflict can reapply an unsaved model that retired after this
          // tab opened, even when the newly saved assignment itself is valid.
          const retiredId = provider?.models.some(option => option.id === step.modelId) ? retired?.modelId : step.modelId;
          return <li key={step.providerId}><span className="ai-position" aria-hidden="true">{index + 1}</span>
            <span><strong>{label}</strong>{step.modelId && <> · {modelLabel(feature, step)}</>}
              {step.providerId === 'local-composer' && ' · English only'}</span>
            {retiredId && provider && <label>{label} fallback model
              <select value={step.modelId} disabled={readOnly} onChange={event => {
                const replacement = replaceModel(step, provider, event.target.value);
                onChange({ ...policy, fallbacks: choices.map(item => item === step ? replacement : item) });
              }}>
                <option value={retiredId} disabled>{retiredId} (retired)</option>
                {provider.models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
              {retired && step.modelId !== retired.modelId && <small>Saved: {retired.modelId}</small>}
            </label>}
            {editing && movable(step) && <div className="ai-move">
              <button type="button" disabled={!movable(choices[index - 1])} aria-label={'Move ' + label + ' up'}
                onClick={event => move(index, -1, event.currentTarget)}><ArrowUp size={16} /></button>
              <button type="button" disabled={!movable(choices[index + 1])} aria-label={'Move ' + label + ' down'}
                onClick={event => move(index, 1, event.currentTarget)}><ArrowDown size={16} /></button>
            </div>}
          </li>;
        })}
      </ol>
      <span role="status" className="sr-only">{announcement}</span>
    </section>
  );
}
