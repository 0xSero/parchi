import { installNetworkObserver } from './background/network-observer.js';
import { BackgroundService } from './background/service.js';

declare const __PERF_DEBUG__: boolean;

// Registered at top level so the observer wakes with the service worker and sees every response (#42).
installNetworkObserver();

const service = new BackgroundService();

if (__PERF_DEBUG__) {
  import('./utils/perf-monitor-bg.js').then(({ bgPerfMonitor }) => {
    bgPerfMonitor.bind(service);
    bgPerfMonitor.start();
  });
}
