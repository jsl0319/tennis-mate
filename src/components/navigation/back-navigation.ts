export function returnToPreviousScreen(historyLength: number, onBack: () => void, onFallback: () => void) {
  if (historyLength > 1) {
    onBack();
    return;
  }

  onFallback();
}
