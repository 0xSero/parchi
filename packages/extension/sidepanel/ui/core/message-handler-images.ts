/**
 * Message Handler - Images Module
 * Handles report image messages
 */

import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle report image captured
 */
export const handleReportImageCaptured = function handleReportImageCaptured(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  this.recordReportImage?.(message.image);
  this.updateReportImageSelection?.(message.selectedImageIds || []);
};

sidePanelProto.handleReportImageCaptured = handleReportImageCaptured;

/**
 * Handle report images selection
 */
export const handleReportImagesSelection = function handleReportImagesSelection(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  this.updateReportImageSelection?.(message.selectedImageIds || []);
};

sidePanelProto.handleReportImagesSelection = handleReportImagesSelection;
