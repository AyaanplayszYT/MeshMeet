import { useState, useRef, useCallback } from 'react';

export interface MeetingRecorderState {
  isRecording: boolean;
  recordingTime: string;
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
}

export const useMeetingRecorder = (): MeetingRecorderState => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Capture screen or tab with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as any,
        audio: true
      });

      streamRef.current = stream;
      recordedChunksRef.current = [];

      // Detect supported mimeType
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      const selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType: selectedMime });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(recordedChunksRef.current, { type: selectedMime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = `MeetMesh-Recording-${dateStr}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);

        setIsRecording(false);
        setRecordingSeconds(0);
      };

      // Handle user stopping screen share from browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      return true;
    } catch (err) {
      console.warn('Recording cancelled or permission denied:', err);
      return false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    recordingTime: formatTime(recordingSeconds),
    startRecording,
    stopRecording
  };
};
