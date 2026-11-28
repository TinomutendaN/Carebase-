/**
 * Source links from the assistant to records on the Patient page. A chip calls
 * focusRecord(); the Timeline shows and highlights the row if it holds it.
 * A lab result the Timeline doesn't list (an in-range result of a less common
 * lab) is shown on the lab chart instead. Browser only.
 */

const RECORD_EVENT = "carebase:focus-record";
const LAB_CHART_EVENT = "carebase:show-lab";

export type FocusRecordDetail = { anchor: string; handled: boolean };
export type ShowLabDetail = { code: string };

/** How long a focused row stays highlighted. */
export const HIGHLIGHT_MS = 2400;

export function focusRecord(anchor: string, labCode?: string): void {
  const detail: FocusRecordDetail = { anchor, handled: false };
  // Listeners run synchronously, so `handled` is set by the time this returns.
  window.dispatchEvent(new CustomEvent(RECORD_EVENT, { detail }));
  if (detail.handled) return;

  if (labCode) {
    window.dispatchEvent(new CustomEvent<ShowLabDetail>(LAB_CHART_EVENT, { detail: { code: labCode } }));
    return;
  }
  const element = document.getElementById(anchor);
  if (element) highlight(element);
}

/** Scroll an element into view and highlight it briefly. */
export function highlight(element: HTMLElement): void {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.dataset.focused = "true";
  window.setTimeout(() => delete element.dataset.focused, HIGHLIGHT_MS);
}

export function onFocusRecord(listener: (detail: FocusRecordDetail) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<FocusRecordDetail>).detail);
  window.addEventListener(RECORD_EVENT, handler);
  return () => window.removeEventListener(RECORD_EVENT, handler);
}

export function onShowLab(listener: (detail: ShowLabDetail) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<ShowLabDetail>).detail);
  window.addEventListener(LAB_CHART_EVENT, handler);
  return () => window.removeEventListener(LAB_CHART_EVENT, handler);
}
