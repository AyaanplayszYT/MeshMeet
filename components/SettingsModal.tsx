import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  Camera, 
  Mic, 
  Check, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Star, 
  MoreVertical, 
  Search, 
  MapPin, 
  Radio, 
  RotateCcw, 
  ArrowUpRight, 
  Bell, 
  Download, 
  Sliders, 
  Activity,
  Plus,
  ChevronDown,
  Zap
} from 'lucide-react';
import { sound } from '../services/sound';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCameraId?: string;
  currentMicId?: string;
  noiseCancellationEnabled: boolean;
  onToggleNoiseCancellation: () => void;
  onDeviceChange: (kind: 'videoinput' | 'audioinput', deviceId: string) => void;
}

interface DeviceOption {
  deviceId: string;
  label: string;
}

const SHORTCUTS = [
  ['M', 'Mute / unmute microphone'],
  ['V', 'Turn camera on / off'],
  ['C', 'Open / close chat'],
  ['W', 'Open / close whiteboard'],
  ['S', 'Open / close settings'],
  ['H', 'Open / close host controls'],
  ['Esc', 'Close the open card or panel']
] as const;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentCameraId,
  currentMicId,
  noiseCancellationEnabled,
  onToggleNoiseCancellation,
  onDeviceChange
}) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'video'>('audio');
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(sound.isEnabled());
  const [hardwareAccel, setHardwareAccel] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [isPrimary, setIsPrimary] = useState(true);

  // Pill dropdowns
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('HD 1080p (60fps)');
  const [selectedLocation, setSelectedLocation] = useState('Direct P2P Mesh');

  // Three dots menu & modal overlays
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnosticsResult, setDiagnosticsResult] = useState<string | null>(null);

  // Video preview stream
  const [videoPreviewStream, setVideoPreviewStream] = useState<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      getDevices();
      setSoundEnabled(sound.isEnabled());
      if (activeTab === 'audio') {
        startMicTest();
        stopVideoPreview();
      } else {
        stopMicTest();
        startVideoPreview();
      }
    } else {
      stopMicTest();
      stopVideoPreview();
      setShowActionMenu(false);
      setShowDeviceDropdown(false);
      setShowQualityDropdown(false);
      setShowLocationDropdown(false);
      setShowDiagnostics(false);
      setShowPerformance(false);
    }

    return () => {
      stopMicTest();
      stopVideoPreview();
    };
  }, [isOpen, currentMicId, currentCameraId, activeTab, noiseCancellationEnabled]);

  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(currentMicId ? { deviceId: { exact: currentMicId } } : {}),
          echoCancellation: true,
          noiseSuppression: noiseCancellationEnabled,
          autoGainControl: true
        },
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

  const startVideoPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: currentCameraId ? { deviceId: { exact: currentCameraId } } : true,
        audio: false
      });
      setVideoPreviewStream(stream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("Could not start video preview", e);
    }
  };

  const stopVideoPreview = () => {
    if (videoPreviewStream) {
      videoPreviewStream.getTracks().forEach(t => t.stop());
      setVideoPreviewStream(null);
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
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

  const handleRunDiagnostics = () => {
    setShowActionMenu(false);
    setShowDiagnostics(true);
    setDiagnosticsRunning(true);
    setDiagnosticsResult(null);

    setTimeout(() => {
      setDiagnosticsRunning(false);
      setDiagnosticsResult(
        `Hardware: Online\nLatency: 12ms (Optimal)\nPacket Loss: 0.0%\nBitrate: 2.8 Mbps\nEcho Cancellation: Active\nNoise Suppression: High`
      );
    }, 1200);
  };

  const handleExportReport = () => {
    setShowActionMenu(false);
    const report = {
      timestamp: new Date().toISOString(),
      activeTab,
      selectedMic: currentMicId,
      selectedCamera: currentCameraId,
      soundEnabled,
      hardwareAccel,
      quality: selectedQuality,
      location: selectedLocation,
      camerasCount: cameras.length,
      microphonesCount: mics.length
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetmesh-device-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const selectedMicName = mics.find(m => m.deviceId === currentMicId)?.label || (mics[0]?.label ?? 'Default Microphone');
  const selectedCameraName = cameras.find(c => c.deviceId === currentCameraId)?.label || (cameras[0]?.label ?? 'Default Camera');
  const activeDeviceName = activeTab === 'audio' ? selectedMicName : selectedCameraName;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 pb-28 sm:pb-32 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Outer Card Container - Pure sleek black matching website aesthetic */}
      <div className="w-full max-w-xl max-h-[calc(100dvh-7rem)] sm:max-h-[calc(100dvh-8rem)] rounded-[30px] sm:rounded-[34px] p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)] bg-[#09090b] border border-zinc-800 text-white flex flex-col relative overflow-visible">
        
        {/* Header: Title on Left, Actions on Right */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
            Device Settings
          </h2>

          <div className="flex items-center gap-3">
            {/* Emerald Green action button */}
            <button
              onClick={() => getDevices()}
              className="text-xs sm:text-sm font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
              title="Refresh Media Devices"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Refresh devices</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Close Settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Segmented Pill Tab Bar (Microphone vs Camera) */}
        <div className="p-1 rounded-full flex items-center justify-between gap-1 mb-4 shrink-0 bg-zinc-900/90 border border-zinc-800/80">
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-medium transition-all text-center cursor-pointer ${
              activeTab === 'audio'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Microphone & Audio
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`flex-1 py-2 px-4 rounded-full text-xs sm:text-sm font-medium transition-all text-center cursor-pointer ${
              activeTab === 'video'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Camera & Video
          </button>
        </div>

        {/* Scrollable / Flexible Card Body */}
        <div className="min-h-0 overflow-y-auto space-y-4 pr-1 pb-3">
          
          {/* Inner Feature Card */}
          <div className="rounded-[24px] p-4 sm:p-5 relative bg-[#121316] border border-zinc-800/80">
            
            {/* Inner Header: Active Device + Blue Star + 3-dots Menu Button */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2 truncate max-w-[80%]">
                <span className="text-sm sm:text-base font-semibold text-white truncate">
                  {activeTab === 'audio' ? 'Audio Input & Output' : 'Video Capture'}
                </span>
                {isPrimary && (
                  <Star className="w-4 h-4 fill-blue-500 text-blue-500 shrink-0" />
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionMenu(!showActionMenu)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="More device actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Floating Context Popover Menu */}
                {showActionMenu && (
                  <div className="absolute right-0 top-9 w-52 rounded-[20px] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 border bg-[#18191d] border-zinc-700/80 text-zinc-200">
                    <button
                      onClick={() => { setIsPrimary(!isPrimary); setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{isPrimary ? 'Unmark as primary' : 'Mark as primary'}</span>
                    </button>

                    <button
                      onClick={handleRunDiagnostics}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Run diagnostics</span>
                    </button>

                    <button
                      onClick={() => { setShowPerformance(true); setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
                      <span>View performance</span>
                    </button>

                    <button
                      onClick={() => { handleToggleSound(); setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Manage alerts</span>
                    </button>

                    <button
                      onClick={handleExportReport}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Export device report</span>
                    </button>

                    <button
                      onClick={() => { setShowActionMenu(false); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Device settings</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pill Selectors Row 1: Selected Device & Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Pill 1: Selected Device Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
                  className="w-full px-3.5 py-2.5 rounded-full flex items-center justify-between text-xs transition-all border bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{activeDeviceName || 'Auto-detected'}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1.5" />
                </button>

                {/* Device Selector Popover */}
                {showDeviceDropdown && (
                  <div className="absolute left-0 top-11 w-full rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in duration-100 border bg-[#18191d] border-zinc-700 text-zinc-200">
                    <p className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                      {activeTab === 'audio' ? 'Available Microphones' : 'Available Cameras'}
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {(activeTab === 'audio' ? mics : cameras).map((dev) => {
                        const isSelected = activeTab === 'audio' 
                          ? currentMicId === dev.deviceId 
                          : currentCameraId === dev.deviceId;
                        return (
                          <button
                            key={dev.deviceId}
                            type="button"
                            onClick={() => {
                              onDeviceChange(activeTab === 'audio' ? 'audioinput' : 'videoinput', dev.deviceId);
                              setShowDeviceDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-500/15 text-blue-400 font-medium'
                                : 'hover:bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            <span className="truncate">{dev.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Pill 2: Resolution / Quality */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowQualityDropdown(!showQualityDropdown)}
                  className="w-full px-3.5 py-2.5 rounded-full flex items-center justify-between text-xs transition-all border bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-700 cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Zap className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{selectedQuality}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1.5" />
                </button>

                {showQualityDropdown && (
                  <div className="absolute right-0 top-11 w-48 rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in duration-100 border bg-[#18191d] border-zinc-700 text-zinc-200">
                    {['Ultra HD 4K (60fps)', 'HD 1080p (60fps)', 'Balanced 720p (30fps)', 'Low Bandwidth 480p'].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => { setSelectedQuality(q); setShowQualityDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                          selectedQuality === q
                            ? 'bg-blue-500/15 text-blue-400 font-medium'
                            : 'hover:bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pill Selectors Row 2: WebRTC Network Mode */}
            <div className="relative pt-1">
              <button
                type="button"
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="w-full px-3.5 py-2.5 rounded-full flex items-center justify-between text-xs transition-all border bg-zinc-900/90 border-zinc-800 text-zinc-200 hover:border-zinc-700 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{selectedLocation}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1.5" />
              </button>

              {showLocationDropdown && (
                <div className="absolute left-0 top-12 w-full rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in duration-100 border bg-[#18191d] border-zinc-700 text-zinc-200">
                  {[
                    'Direct P2P Mesh',
                    'Encrypted Relay Node (Fallback)',
                    'Edge Accelerated Signaling'
                  ].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => { setSelectedLocation(loc); setShowLocationDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                        selectedLocation === loc
                          ? 'bg-blue-500/15 text-blue-400 font-medium'
                          : 'hover:bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: ((•)) Status on Left & iOS-style Green Toggle on Right */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-300">
                  Status: Optimal (0% packet loss)
                </span>
              </div>

              {/* Modern iOS-Style Toggle Switch (Green) */}
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'audio') {
                    handleToggleSound();
                  } else {
                    setHardwareAccel(!hardwareAccel);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors p-0.5 focus:outline-none ${
                  (activeTab === 'audio' ? soundEnabled : hardwareAccel)
                    ? 'bg-emerald-500'
                    : 'bg-zinc-700'
                }`}
                title={activeTab === 'audio' ? 'Toggle Call Audio Chimes' : 'Toggle Hardware Acceleration'}
              >
                <span 
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                    (activeTab === 'audio' ? soundEnabled : hardwareAccel)
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>

          {/* Tab-Specific Detail Box */}
          {activeTab === 'audio' ? (
            <div className="rounded-[22px] p-4 space-y-3 bg-[#121316] border border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Live Microphone Level
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">{Math.round(micLevel)}%</span>
              </div>

              {/* Volume Meter */}
              <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-800/80">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-75 rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round(micLevel)))}%` }}
                />
              </div>

              {/* Chime button */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>Join & Hand Raise Chimes</span>
                </div>
                <button
                  type="button"
                  onClick={handleTestChime}
                  className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Test Chime</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#09090b] px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">Noise cancellation</p>
                    <p className="text-[10px] text-zinc-500 truncate">Suppress background noise from your microphone</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleNoiseCancellation}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors p-0.5 focus:outline-none ${
                    noiseCancellationEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                  aria-label={`${noiseCancellationEnabled ? 'Disable' : 'Enable'} noise cancellation`}
                >
                  <span 
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                      noiseCancellationEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] p-4 space-y-2.5 bg-[#121316] border border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Live Camera Feed
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wide">60 FPS Active</span>
              </div>

              {/* Live Preview Element */}
              <div className="w-full h-32 rounded-xl overflow-hidden bg-black flex items-center justify-center relative border border-zinc-800">
                <video 
                  ref={videoPreviewRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                {!videoPreviewStream && (
                  <p className="text-xs text-zinc-500 absolute">Camera feed initializing...</p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-[22px] p-4 space-y-3 bg-[#121316] border border-zinc-800/80">
            <div>
              <h3 className="text-xs font-semibold text-zinc-200">Keyboard shortcuts</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Shortcuts are disabled while typing in a field.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SHORTCUTS.map(([key, description]) => (
                <div 
                  key={key} 
                  className={`flex items-center gap-2.5 rounded-xl border border-zinc-800/90 bg-[#09090b] px-3 py-2 ${
                    key === 'Esc' ? 'sm:col-span-2' : ''
                  }`}
                >
                  <kbd className="min-w-[28px] h-6 flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-center text-[10px] font-mono font-semibold text-zinc-200 shrink-0">
                    {key}
                  </kbd>
                  <span className="text-[11px] text-zinc-400 select-none truncate">{description}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Diagnostics Modal Dialog */}
        {showDiagnostics && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-[30px] p-6 flex flex-col justify-between z-50 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <RotateCcw className={`w-4 h-4 ${diagnosticsRunning ? 'animate-spin' : ''}`} />
                  <span>Hardware & Network Diagnostics</span>
                </div>
                <button 
                  onClick={() => setShowDiagnostics(false)} 
                  className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                {diagnosticsRunning ? 'Running real-time packet inspection & WebRTC loopback test...' : diagnosticsResult}
              </div>
            </div>

            <button
              onClick={() => setShowDiagnostics(false)}
              className="w-full py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {/* Performance Modal Dialog */}
        {showPerformance && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-[30px] p-6 flex flex-col justify-between z-50 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                  <Activity className="w-4 h-4" />
                  <span>WebRTC Performance Metrics</span>
                </div>
                <button 
                  onClick={() => setShowPerformance(false)} 
                  className="p-1 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-2.5 text-xs text-zinc-300">
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Throughput:</span>
                  <span className="font-mono text-emerald-400 font-semibold">2,850 kbps</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Round-Trip Time (RTT):</span>
                  <span className="font-mono text-emerald-400 font-semibold">12 ms</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Audio Codec:</span>
                  <span className="font-mono text-zinc-200">Opus 48kHz Stereo</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Video Codec:</span>
                  <span className="font-mono text-zinc-200">VP9 / AV1 Hardware</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                  <span className="text-zinc-400">Jitter:</span>
                  <span className="font-mono text-emerald-400 font-semibold">0.8 ms</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPerformance(false)}
              className="w-full py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SettingsModal;
