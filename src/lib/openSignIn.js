/** Ask the mounted account menu to open its sign-in dialog. */
export const OPEN_SIGN_IN_EVENT = 'tableau:open-sign-in';

export function requestSignIn() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_SIGN_IN_EVENT));
}
