/** IME candidate confirmation is not an application shortcut.
 * WebKit can clear isComposing before the confirming Enter; 229 covers it.
 */
export function guardImeKey(event: {
  key: string;
  nativeEvent: { isComposing?: boolean; keyCode?: number };
  preventDefault(): void;
  stopPropagation(): void;
}): boolean {
  if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) return false;
  if (event.key === 'Enter') event.preventDefault(); // Block implicit form submission.
  event.stopPropagation();
  return true;
}
