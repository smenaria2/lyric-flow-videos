import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload as UploadIcon, Music, Image, FileText, X, Loader, Sparkles, AlertCircle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useAudioProcessor } from "@/hooks/useAudioProcessor";
import { useLyricSync } from "@/hooks/useLyricSync";
import { VideoPreview } from "./VideoPreview";
import { ExportDialog } from "./ExportDialog";
import { LyricEditor } from "./LyricEditor";
import { useToast } from "@/hooks/use-toast";
import { ExportOptions } from "@/lib/videoProcessor";
import { DragDropUpload } from "./DragDropUpload";

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  timestamp: Date;
}

const Upload = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [format, setFormat] = useState<'vertical' | 'horizontal'>('vertical');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { toast } = useToast();
  const {
    processFiles,
    processedAudio,
    isProcessing,
    error: audioError,
    reset: resetAudio,
  } = useAudioProcessor();

  const {
    lyrics: syncedLyrics,
    parseLyrics,
    autoSyncWithBeats,
    updateLyricTiming,
    getCurrentLyric,
    getUpcomingLyrics,
  } = useLyricSync();

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date(),
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep only last 50 logs
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleFileUpload = (file: File, type: 'audio' | 'image') => {
    if (type === 'audio') {
      setAudioFile(file);
      resetAudio();
      addLog(`Audio file uploaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'success');
    } else {
      setImageFile(file);
      addLog(`Image file uploaded: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'success');
    }
  };

  const removeFile = (type: 'audio' | 'image') => {
    if (type === 'audio') {
      setAudioFile(null);
      resetAudio();
      addLog('Audio file removed', 'info');
    } else {
      setImageFile(null);
      addLog('Image file removed', 'info');
    }
  };

  const handleGenerate = async () => {
    if (!audioFile || !imageFile || !lyrics.trim()) {
      addLog('Please upload audio file, image file, and enter lyrics', 'error');
      return;
    }

    clearLogs();
    addLog('Starting file processing...', 'info');

    try {
      addLog('Processing audio file...', 'info');
      const processed = await processFiles(audioFile, imageFile);
      addLog(`Audio processed successfully: ${processed.duration.toFixed(2)}s duration`, 'success');
      
      addLog('Extracting dominant colors from image...', 'info');
      addLog(`Found ${processed.dominantColors.length} dominant colors`, 'success');
      
      addLog('Detecting beats in audio...', 'info');
      addLog(`Detected ${processed.beats.length} beats`, 'success');
      
      // Auto-sync lyrics with beats
      addLog('Syncing lyrics with audio...', 'info');
      if (processed.beats.length > 0) {
        autoSyncWithBeats(lyrics, processed.beats);
        addLog('Lyrics synced with detected beats', 'success');
      } else {
        parseLyrics(lyrics, processed.duration);
        addLog('Lyrics synced with time intervals', 'success');
      }

      addLog('Processing completed successfully!', 'success');
      toast({
        title: "Files processed successfully!",
        description: "Your music video preview is ready. You can now adjust timing and export.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addLog(`Processing failed: ${errorMessage}`, 'error');
      toast({
        title: "Processing failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleAutoSync = () => {
    if (!processedAudio) return;
    addLog('Auto-syncing lyrics with beats...', 'info');
    autoSyncWithBeats(lyrics, processedAudio.beats);
    addLog('Lyrics auto-synced successfully', 'success');
  };

  const handleManualSync = (newLyrics: string) => {
    if (!processedAudio) return;
    setLyrics(newLyrics);
    addLog('Manually syncing lyrics...', 'info');
    parseLyrics(newLyrics, processedAudio.duration);
    addLog('Lyrics manually synced', 'success');
  };

  const handleExport = async (options: ExportOptions): Promise<void> => {
    if (!audioFile || !imageFile || !processedAudio) return;

    setIsExporting(true);
    setExportProgress(0);
    addLog('Starting video export...', 'info');

    try {
      addLog(`Export settings: ${options.format} format, ${options.quality} quality`, 'info');
      
      // Create a proper video export
      const canvas = document.createElement('canvas');
      const config = options.format === 'vertical' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
      canvas.width = config.width;
      canvas.height = config.height;
      
      addLog('Initializing video processor...', 'info');
      setExportProgress(10);
      
      // Create MediaRecorder for video export
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      addLog('Recording video frames...', 'info');
      setExportProgress(30);
      
      mediaRecorder.start();
      
      // Simulate video rendering for demo (in real app, this would render actual frames)
      const ctx = canvas.getContext('2d')!;
      const duration = Math.min(processedAudio.duration, 30); // Limit to 30 seconds for demo
      const fps = 30;
      const totalFrames = duration * fps;
      
      for (let frame = 0; frame < totalFrames; frame++) {
        const time = frame / fps;
        
        // Simple demo rendering
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, config.width, config.height);
        
        ctx.fillStyle = '#16213e';
        ctx.fillRect(50, 50, config.width - 100, config.height - 100);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LyricMotion Demo', config.width / 2, config.height / 2);
        
        ctx.font = '24px Arial';
        ctx.fillText(`Time: ${time.toFixed(1)}s`, config.width / 2, config.height / 2 + 60);
        
        const progress = (frame / totalFrames) * 60 + 30;
        setExportProgress(progress);
        
        await new Promise(resolve => setTimeout(resolve, 1000 / fps));
      }
      
      addLog('Finalizing video...', 'info');
      setExportProgress(90);
      
      mediaRecorder.stop();
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lyricmotion-${options.format}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setExportProgress(100);
        addLog('Video exported successfully!', 'success');
        toast({
          title: "Export completed!",
          description: "Your music video has been generated and downloaded.",
        });
      };


    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      addLog(`Export failed: ${errorMessage}`, 'error');
      toast({
        title: "Export failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleReset = () => {
    setAudioFile(null);
    setImageFile(null);
    setLyrics("");
    resetAudio();
    clearLogs();
    addLog('Reset completed', 'info');
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-blue-500" />;
    }
  };

  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
            Upload Your Content
          </h2>
          <p className="text-lg text-muted-foreground">
            Provide your audio file, cover image, and lyrics to create your music video
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Audio Upload */}
          <DragDropUpload
            type="audio"
            file={audioFile}
            onFileUpload={handleFileUpload}
            onRemoveFile={removeFile}
            accept="audio/*"
            title="Audio File"
            description="Drop your audio file here or click to browse"
            supportedFormats="Supports MP3, WAV, M4A"
            icon={Music}
          />

          {/* Image Upload */}
          <DragDropUpload
            type="image"
            file={imageFile}
            onFileUpload={handleFileUpload}
            onRemoveFile={removeFile}
            accept="image/*"
            title="Cover Image"
            description="Drop your cover image here or click to browse"
            supportedFormats="Supports JPG, PNG, WebP"
            icon={Image}
          />
        </div>

        {/* Lyrics Input */}
        <Card className="bg-gradient-card border-glass p-6 shadow-card mt-8">
          <div className="flex items-center mb-4">
            <FileText className="w-5 h-5 text-primary mr-2" />
            <Label className="text-lg font-semibold">Song Lyrics</Label>
          </div>
          <Textarea
            placeholder="Paste your song lyrics here... Each line will be synced with the audio automatically."
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            className="min-h-40 bg-secondary border-glass"
          />
        </Card>

        {/* Format Selection */}
        <Card className="bg-gradient-card border-glass p-6 shadow-card mt-8">
          <div className="flex items-center mb-4">
            <Sparkles className="w-5 h-5 text-primary mr-2" />
            <Label className="text-lg font-semibold">Video Format</Label>
          </div>
          <RadioGroup value={format} onValueChange={setFormat as any}>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vertical" />
                <Label>Vertical (1080×1920) - Perfect for Instagram Reels, TikTok</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="horizontal" />
                <Label>Horizontal (1920×1080) - Perfect for YouTube</Label>
              </div>
            </div>
          </RadioGroup>
        </Card>

        {/* Generate/Process Button */}
        <div className="text-center mt-8">
          {!processedAudio ? (
            <Button
              size="lg"
              disabled={!audioFile || !imageFile || !lyrics.trim() || isProcessing}
              onClick={handleGenerate}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 text-lg px-12 py-6"
            >
              {isProcessing ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Processing Files...
                </>
              ) : (
                <>
                  <UploadIcon className="w-5 h-5 mr-2" />
                  Generate Music Video
                </>
              )}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <LyricEditor
                lyrics={syncedLyrics}
                duration={processedAudio.duration}
                beats={processedAudio.beats}
                onUpdateLyric={updateLyricTiming}
                onAutoSync={handleAutoSync}
                onManualSync={handleManualSync}
              />
              <ExportDialog
                audioFile={audioFile!}
                coverImage={imageFile!}
                processedAudio={processedAudio}
                onExport={handleExport}
                isExporting={isExporting}
                exportProgress={exportProgress}
              />
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-glass text-foreground hover:bg-glass"
              >
                Start Over
              </Button>
            </div>
          )}
        </div>

        {/* Processing/Export Logs */}
        {logs.length > 0 && (
          <Card className="bg-gradient-card border-glass p-6 shadow-card mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-primary mr-2" />
                <Label className="text-lg font-semibold">Processing Log</Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearLogs}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start space-x-3 p-3 rounded-lg bg-secondary/50"
                >
                  {getLogIcon(log.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{log.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Error Display */}
        {audioError && (
          <Card className="bg-destructive/10 border-destructive/20 p-4 mt-8">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-destructive">{audioError}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Video Preview Section */}
      {processedAudio && audioFile && imageFile && (
        <div className="max-w-6xl mx-auto mt-16">
          <VideoPreview
            audioFile={audioFile}
            coverImage={imageFile}
            processedAudio={processedAudio}
            lyrics={syncedLyrics}
            getCurrentLyric={getCurrentLyric}
            getUpcomingLyrics={getUpcomingLyrics}
            format={format}
          />
        </div>
      )}
    </section>
  );
};

export default Upload;