export function handleRadioGroupKeyDown(event, values, onChange) {
  if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const radios = [...event.currentTarget.querySelectorAll('[role="radio"]')];
  const currentIndex = radios.indexOf(event.target.closest('[role="radio"]'));
  if (currentIndex < 0 || radios.length !== values.length) return;

  event.preventDefault();
  const nextIndex = event.key === 'Home' ? 0
    : event.key === 'End' ? values.length - 1
      : (currentIndex + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + values.length) % values.length;
  onChange(values[nextIndex]);
  radios[nextIndex].focus();
}
