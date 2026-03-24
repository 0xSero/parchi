export function hasVisibleContent(el: HTMLElement): boolean {
  const text = el.textContent || '';
  const cleaned = text.replace(/Thinking\.\.\./g, '').replace(/Thought process/g, '').trim();
  return cleaned.length > 0 || el.querySelectorAll('img, video, canvas, svg.report-image').length > 0;
}

export function removeEmptyAssistantContainers(self: any): void {
  const chatMessages = self.elements?.chatMessages;
  if (!chatMessages) return;
  const empties = chatMessages.querySelectorAll('.message.assistant');
  for (const el of Array.from(empties)) {
    if (!hasVisibleContent(el as HTMLElement)) {
      (el as HTMLElement).remove();
    }
  }
}
