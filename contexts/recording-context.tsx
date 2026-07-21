import { createContext, ReactNode, useCallback, useContext, useRef } from 'react';

type RecordingHandlers = {
  triggerManualCapture: () => Promise<void>;
  stopCaptureEarly: () => void;
  pauseMonitoring: () => Promise<void>;
  resumeMonitoring: () => Promise<void>;
};

type RecordingContextValue = RecordingHandlers & {
  registerHandlers: (handlers: RecordingHandlers) => void;
};

const noopHandlers: RecordingHandlers = {
  triggerManualCapture: async () => {},
  stopCaptureEarly: () => {},
  pauseMonitoring: async () => {},
  resumeMonitoring: async () => {},
};

export const RecordingContext = createContext<RecordingContextValue | null>(null);

// The calculator screen owns the actual recorder (via useSpikeDetection), but
// the listening/incidents screens are sibling routes, not children of it —
// so their handlers are registered here to be reachable from anywhere else.
export function RecordingProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<RecordingHandlers>(noopHandlers);

  const registerHandlers = useCallback((handlers: RecordingHandlers) => {
    handlersRef.current = handlers;
  }, []);

  const triggerManualCapture = useCallback(() => handlersRef.current.triggerManualCapture(), []);
  const stopCaptureEarly = useCallback(() => handlersRef.current.stopCaptureEarly(), []);
  const pauseMonitoring = useCallback(() => handlersRef.current.pauseMonitoring(), []);
  const resumeMonitoring = useCallback(() => handlersRef.current.resumeMonitoring(), []);

  return (
    <RecordingContext.Provider
      value={{
        triggerManualCapture,
        stopCaptureEarly,
        pauseMonitoring,
        resumeMonitoring,
        registerHandlers,
      }}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within the RecordingContext.Provider');
  }
  return context;
}
