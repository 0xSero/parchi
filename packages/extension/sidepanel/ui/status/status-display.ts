// Status display functions - agent state, run timers, activity indicators

import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

/**
 * Update the status text and indicator dot.
 * @param text - Status message to display
 * @param type - Status type: 'default', 'error', 'warning', 'active', 'success'
 */
sidePanelProto.updateStatus = function updateStatus(text: string, type = 'default') {
  if (this.elements.statusText) {
    this.elements.statusText.textContent = text;
  }
  const statusDot = document.getElementById('statusDot');
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (type === 'error') statusDot.classList.add('error');
    else if (type === 'warning') statusDot.classList.add('warning');
    else if (type === 'active') statusDot.classList.add('active');
  }
  this.updateActivityState();
};

/**
 * Start the run timer to track agent execution time.
 */
sidePanelProto.startRunTimer = function startRunTimer() {
  if (this.runTimerId) {
    window.clearInterval(this.runTimerId);
  }
  this.runStartedAt = Date.now();
  const tick = () => {
    this.updateActivityState?.();
  };
  tick();
  this.runTimerId = window.setInterval(tick, 1000);
};

/**
 * Stop the run timer and clear execution tracking.
 */
sidePanelProto.stopRunTimer = function stopRunTimer() {
  if (this.runTimerId) {
    window.clearInterval(this.runTimerId);
    this.runTimerId = null;
  }
  this.runStartedAt = null;
  this.updateActivityState?.();
};
