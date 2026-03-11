import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.ingestFilesIntoComposer = async function ingestFilesIntoComposer(
  files: File[],
  source: 'picker' | 'paste' = 'picker',
) {
  if (!Array.isArray(files) || files.length === 0) return;

  const maxPerFile = 4000;
  const maxInlineMediaBytes = 4 * 1024 * 1024;
  const mediaAttachments = Array.isArray(this.pendingComposerAttachments) ? [...this.pendingComposerAttachments] : [];

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  for (const file of files) {
    const mime = String(file.type || '').toLowerCase();
    const name = file.name || `${source}-attachment`;
    const isImage = mime.startsWith('image/');
    const isVideo = mime.startsWith('video/');
    const isAudio = mime.startsWith('audio/');
    const isMedia = isImage || isVideo || isAudio;

    if (isMedia) {
      if (file.size > maxInlineMediaBytes) {
        this.elements.userInput.value += `\n\n[Attachment skipped: ${name} (${mime || 'media'}) is larger than 4MB]`;
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        mediaAttachments.push({
          kind: isImage ? 'image' : isVideo ? 'video' : 'audio',
          name,
          mimeType: mime || 'application/octet-stream',
          size: file.size || 0,
          dataUrl,
        });
        this.elements.userInput.value += `\n\n[Attached ${isImage ? 'image' : isVideo ? 'video' : 'audio'}: ${name}]`;
      } catch (e) {
        console.warn('Failed to read media attachment', name, e);
      }
      continue;
    }

    try {
      const text = await file.text();
      const trimmed = text.length > maxPerFile ? `${text.slice(0, maxPerFile)}\n… (truncated)` : text;
      this.elements.userInput.value += `\n\n[File: ${name}]\n${trimmed}`;
    } catch (e) {
      console.warn('Failed to read file', name, e);
    }
  }

  this.pendingComposerAttachments = mediaAttachments.slice(-8);
  if (mediaAttachments.length > 0) {
    this.updateStatus(
      `${mediaAttachments.length} media attachment${mediaAttachments.length === 1 ? '' : 's'} ready`,
      'active',
    );
  }
  this.elements.userInput.focus();
};

sidePanelProto.handleFileSelection = async function handleFileSelection(event: Event) {
  const input = event.target as HTMLInputElement | null;
  if (!input) return;
  const files = Array.from(input.files || []) as File[];
  if (!files.length) return;

  await this.ingestFilesIntoComposer(files, 'picker');
  input.value = '';
};
