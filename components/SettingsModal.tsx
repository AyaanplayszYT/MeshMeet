import React, { useEffect, useState, useRef } from 'react';
import { X, Camera, Mic, Settings, Check, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { sound } from '../services/sound';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCameraId?: string;
  currentMicId?: string;
  onDeviceChange: (kind: 'videoinput' | 'audioinput', deviceId: string) => void;
}

interface DeviceOption {
  deviceId: string;
  label: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentCameraId,
  currentMicId,
  onDeviceChange
}) => {
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(sound.isEnabled());
  const [micLevel, setMicLevel] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      getDevices();
      setSoundEnabled(sound.isEnabled());
      startMicTest();
    } else {
      stopMicTest();
    }

    return () => {
      stopMicTest();
    };
  }, [isOpen, currentMicId]);

  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: currentMicId ? { deviceId: { exact: currentMicId } } : true,
        video: false
      });
      testStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 60) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      // Microphone testing fallback
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicLevel(0);
  };

  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 4)}` }));
        
      const audioDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 4)}` }));

      setCameras(videoDevices);
      setMics(audioDevices);
    } catch (e) {
      console.error("Error enumerating devices", e);
    }
  };

  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    sound.setEnabled(nextState);
    setSoundEnabled(nextState);
    if (nextState) {
      sound.playJoinChime();
    }
  };

  const handleTestChime = () => {
    sound.playJoinChime();
    setTimeout(() => sound.playHandRaiseChime(), 350);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 pb-24 sm:pb-12 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-zinc-950/90 backdrop-blur-3xl border border-white/15 ring-1 ring-white/10 rounded-[32px] shadow-[0_25px_80px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden flex flex-col max-h-[82vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-2xl">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Meeting Settings</h3>
              <p className="text-xs text-zinc-400">Audio, Video & Notification preferences</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Responsive Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Column: Video / Camera Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-300 text-xs font-bold uppercase tracking-wider">
              <Camera className="w-4 h-4 text-blue-400" />
              <span>Camera Devices</span>
            </div>

            <div className="space-y-2">
              {cameras.length === 0 && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-zinc-500 text-xs">
                  No cameras detected. Check browser permissions.
                </div>
              )}
              {cameras.map(device => {
                const isSelected = currentCameraId === device.deviceId;
                return (
                  <button
                    key={device.deviceId}
                    onClick={() => onDeviceChange('videoinput', device.deviceId)}
                    className={`w-full text-left px-4 py-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-md' 
                        : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/[0.05] hover:border-white/20'
                    }`}
                  >
                    <span className="truncate text-sm font-medium">{device.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Video Quality</span>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Hardware-accelerated HD video with automatic resolution scaling based on network throughput.
              </p>
            </div>
          </div>

          {/* Right Column: Audio, Mic Level & Sound Effects */}
          <div className="space-y-5">
            
            {/* Audio Output / Chimes */}
            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-zinc-500'}`}>
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">Call Sound Effects</span>
                    <p className="text-[11px] text-zinc-400">Audio chimes for joins & chat</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`w-11 h-6 rounded-full transition-all relative ${
                    soundEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {soundEnabled && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[11px] text-zinc-400">Test audio output</span>
                  <button
                    type="button"
                    onClick={handleTestChime}
                    className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all flex items-center gap-1.5 border border-white/10"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Play Chime
                  </button>
                </div>
              )}
            </div>

            {/* Microphones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-300 text-xs font-bold uppercase tracking-wider">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>Microphone</span>
                </div>
                
                {/* Live Mic Level Bar */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-400">Live Level:</span>
                  <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/10">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75"
                      style={{ width: `${micLevel}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {mics.length === 0 && (
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-zinc-500 text-xs">
                    No microphones detected. Check browser permissions.
                  </div>
                )}
                {mics.map(device => {
                  const isSelected = currentMicId === device.deviceId;
                  return (
                    <button
                      key={device.deviceId}
                      onClick={() => onDeviceChange('audioinput', device.deviceId)}
                      className={`w-full text-left px-4 py-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-600/20 border-emerald-500/50 text-white shadow-md' 
                          : 'bg-white/[0.02] border-white/10 text-zinc-300 hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      <span className="truncate text-sm font-medium">{device.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-white/[0.01] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-white text-black font-bold hover:bg-zinc-200 transition-all shadow-md text-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
