import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    SelfieSegmentation: any;
  }
}

export const useBackgroundBlur = (rawStream: MediaStream | null) => {
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const selfieSegmentationRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    // Initialize MediaPipe Selfie Segmentation
    if (window.SelfieSegmentation) {
      const selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
        },
      });

      selfieSegmentation.setOptions({
        modelSelection: 1, // 0: General, 1: Landscape (faster)
      });

      selfieSegmentation.onResults(onResults);
      selfieSegmentationRef.current = selfieSegmentation;
    } else {
        console.warn("SelfieSegmentation script not loaded");
    }

    // Prepare hidden video element for processing
    videoRef.current.autoplay = true;
    videoRef.current.playsInline = true;
    videoRef.current.muted = true; // Essential

    return () => {
        if (selfieSegmentationRef.current) {
            selfieSegmentationRef.current.close();
        }
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const onResults = (results: any) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw the raw image first
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // 2. Draw the mask using 'destination-in' composite
    // This keeps only the pixels where the mask is (the person)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

    // 3. Draw the blurred background using 'destination-over'
    // This draws BEHIND the existing content (the cut-out person)
    ctx.globalCompositeOperation = 'destination-over';
    ctx.filter = 'blur(10px)';
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    ctx.restore();
  };

  useEffect(() => {
    // Processing Loop
    const processVideo = async () => {
      if (
        videoRef.current.readyState >= 2 &&
        videoRef.current.videoWidth > 0 &&
        videoRef.current.videoHeight > 0 &&
        selfieSegmentationRef.current
      ) {
         try {
             await selfieSegmentationRef.current.send({ image: videoRef.current });
         } catch (e) {
             // Ignore dropped frames
         }
      }
      if (isBlurEnabled) {
          animationFrameRef.current = requestAnimationFrame(processVideo);
      }
    };

    if (isBlurEnabled && rawStream) {
        // Setup Canvas Stream
        const videoTrack = rawStream.getVideoTracks()[0];
        if (videoTrack) {
            const { width, height } = videoTrack.getSettings();
            canvasRef.current.width = width || 640;
            canvasRef.current.height = height || 480;

            videoRef.current.srcObject = rawStream;
            videoRef.current.play().catch(e => console.error("Hidden video play failed", e));

            // Start processing
            processVideo();

            // Capture stream from canvas (30 FPS)
            const canvasStream = canvasRef.current.captureStream(30);
            
            // Merge with original audio
            const audioTracks = rawStream.getAudioTracks();
            if (audioTracks.length > 0) {
                canvasStream.addTrack(audioTracks[0]);
            }
            
            setProcessedStream(canvasStream);
        }
    } else {
        // Stop processing
        cancelAnimationFrame(animationFrameRef.current);
        if (videoRef.current.srcObject) {
            videoRef.current.srcObject = null;
        }
        setProcessedStream(null);
    }
  }, [isBlurEnabled, rawStream]);

  // If blur is disabled or processing isn't ready, return raw stream
  // If blur is enabled and processed stream is ready, return processed stream
  const finalStream = (isBlurEnabled && processedStream) ? processedStream : rawStream;

  return {
      finalStream,
      isBlurEnabled,
      toggleBlur: () => setIsBlurEnabled(prev => !prev)
  };
};