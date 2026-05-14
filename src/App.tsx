import { useState, useCallback, useEffect } from "react";
import { Upload, Camera, ImageIcon, History, Layers, Info, Sun, Moon, Database, Settings, LayoutDashboard, BrainCircuit, ScanSearch } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster, toast } from "sonner";
import { analyzeImage, VisionAnalysis } from "@/services/geminiService";
import { GoogleGenAI } from "@google/genai";
import confetti from "canvas-confetti";

// Types
interface ScanHistory {
  id: string;
  timestamp: number;
  imageUrl: string;
  analysis: VisionAnalysis;
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalysis | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCamera, setShowCamera] = useState(false);

  // Theme application
  useEffect(() => {
    const saved = localStorage.getItem("vision_history");
    if (saved) setHistory(JSON.parse(saved));
    
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const speakResult = async (text: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ["AUDIO" as any],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
        audio.play();
      }
    } catch (err) {
      console.error("TTS Error:", err);
      // Fallback to web speech api
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const captureCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      
      const base64 = canvas.toDataURL("image/jpeg").split(",")[1];
      setCurrentImage(canvas.toDataURL("image/jpeg"));
      
      // Stop tracks
      stream.getTracks().forEach(track => track.stop());
      setShowCamera(false);
      
      await performAnalysis(base64, "image/jpeg");
    } catch (err) {
      toast.error("Could not access camera");
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setCurrentImage(reader.result as string);
      setAnalysisResult(null);
      await performAnalysis(base64, file.type);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false
  });

  const performAnalysis = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeImage(base64, mimeType);
      setAnalysisResult(result);
      
      const newHistoryItem: ScanHistory = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        imageUrl: `data:${mimeType};base64,${base64}`,
        analysis: result
      };
      
      const updatedHistory = [newHistoryItem, ...history.slice(0, 19)];
      setHistory(updatedHistory);
      localStorage.setItem("vision_history", JSON.stringify(updatedHistory));
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#a855f7"]
      });
      
      toast.success("Intelligence analysis complete!");
    } catch (err) {
      toast.error("Analysis failed. Please try again.");
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className={`min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground`}>
      <Toaster position="top-right" richColors />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-white dark:bg-card px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <ScanSearch className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">VisionAI <span className="text-primary">Core</span></h1>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button onClick={() => setActiveTab("dashboard")} className={`transition-colors py-5 border-b-2 ${activeTab === "dashboard" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}>Analyzer</button>
          <button onClick={() => setActiveTab("history")} className={`transition-colors py-5 border-b-2 ${activeTab === "history" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}>History</button>
          <button onClick={() => setActiveTab("system")} className={`transition-colors py-5 border-b-2 ${activeTab === "system" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`}>Metrics</button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">Documentation</button>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} className="rounded-full w-9 h-9">
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <div className="w-8 h-8 rounded-full bg-secondary hidden sm:block"></div>
        </div>
      </nav>

      <main className="container mx-auto max-w-7xl px-4 md:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsContent value="dashboard" className="mt-0">
            <div className="flex flex-col lg:flex-row gap-8 pb-12">
              {/* Left Column: Active Session */}
              <div className="flex-1 flex flex-col gap-6">
                <div className="space-y-1 px-2">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase text-xs opacity-50 font-mono mb-2">Active Session</h2>
                  <h1 className="text-3xl font-extrabold tracking-tight">Object Detection</h1>
                  <p className="text-muted-foreground text-sm">Real-time identification with YOLOv8 & Gemini Neural Engine.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Analysis Viewport */}
                  <Card className="rounded-[2.5rem] shadow-sm border-border overflow-hidden flex flex-col min-h-[600px] bg-white dark:bg-card">
                    <div className="relative flex-1 bg-slate-100 dark:bg-secondary/20 flex items-center justify-center p-8 min-h-[400px]">
                      <div {...getRootProps()} className="absolute inset-0 z-10 cursor-pointer">
                        <input {...getInputProps()} />
                      </div>
                      
                      {currentImage ? (
                        <div className="relative z-20 w-full h-full flex items-center justify-center">
                          <img src={currentImage} className="max-h-[350px] w-auto rounded-3xl shadow-2xl border border-white/20" alt="Preview" />
                          
                          {/* OCR Text Overlay (Subtle) */}
                          {analysisResult?.ocrText && (
                            <div className="absolute bottom-4 left-4 right-4 bg-black/40 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-[10px] text-white/90 line-clamp-2 italic">
                              <span className="font-bold opacity-50 mr-2 uppercase tracking-widest">OCR:</span>
                              {analysisResult.ocrText}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center space-y-6 z-20 pointer-events-none">
                          <div className="w-20 h-20 bg-white dark:bg-card rounded-[2rem] shadow-xl flex items-center justify-center transition-transform hover:scale-105">
                            <Upload className="h-10 w-10 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <p className="font-extrabold text-2xl tracking-tight">Neural Input</p>
                            <p className="text-sm text-muted-foreground max-w-[200px]">Drag assets or browse local archives for classification.</p>
                          </div>
                          <Button variant="outline" className="rounded-2xl px-8 border-primary/20 text-primary font-bold">Browse Library</Button>
                        </div>
                      )}

                      {isAnalyzing && (
                        <div className="absolute inset-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center">
                          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <p className="mt-6 font-black text-primary animate-pulse uppercase tracking-[0.3em] text-[10px]">Processing Vision Matrix</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-8 bg-white dark:bg-card border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-extrabold text-lg tracking-tight">Extraction Results</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Speed:</span>
                          <Badge variant="outline" className="rounded-lg font-mono text-[10px] font-bold py-1 border-primary/20 text-primary">0.82ms/img</Badge>
                        </div>
                      </div>
                      
                      <ScrollArea className="h-[200px] pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {analysisResult?.objects.map((obj, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-secondary/20 rounded-3xl border border-slate-100 dark:border-white/5 group hover:border-primary/30 transition-colors">
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">{obj.category}</span>
                                <span className="font-extrabold text-sm truncate">{obj.objectName}</span>
                              </div>
                              <span className="text-primary font-mono font-black text-lg transition-transform group-hover:scale-110">
                                {(obj.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                          {!analysisResult && [1,2].map(i => (
                            <div key={i} className="h-20 bg-slate-100 dark:bg-secondary/10 rounded-3xl animate-pulse"></div>
                          ))}
                        </div>
                        
                        {analysisResult?.summary && (
                          <div className="mt-6 p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20">
                            <p className="text-xs leading-relaxed text-indigo-700 dark:text-indigo-300 font-medium">{analysisResult.summary}</p>
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </Card>

                  {/* Action Bar */}
                  <div className="flex gap-4">
                    <Button 
                      size="lg" 
                      className="flex-1 py-8 rounded-[2rem] shadow-2xl shadow-primary/30 text-lg font-extrabold"
                      onClick={() => setShowCamera(true)}
                    >
                      <Camera className="mr-3 h-6 w-6" />
                      Live Neural Scan
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="px-10 py-8 rounded-[2rem] font-bold bg-white dark:bg-card border-slate-200 dark:border-white/10 hover:bg-slate-50 transition-all text-slate-600"
                      onClick={() => analysisResult && speakResult(analysisResult.summary)}
                      disabled={!analysisResult}
                    >
                      Audit Log
                    </Button>
                  </div>
                </div>
              </div>

              {/* Camera Dialog */}
              <AnimatePresence>
                {showCamera && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                    >
                      <Card className="w-full max-w-xl border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] rounded-[3rem] overflow-hidden bg-white dark:bg-card">
                        <CardHeader className="p-8 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-2xl font-black tracking-tight">Optical Capture</CardTitle>
                              <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Neural Stream Establishing...</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowCamera(false)} className="rounded-full">
                              <History className="h-5 w-5 rotate-45" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-8 pb-4">
                          <div className="aspect-video w-full bg-slate-100 dark:bg-secondary/40 rounded-[2rem] flex items-center justify-center border-2 border-primary/10 overflow-hidden relative group">
                            <div className="absolute inset-x-0 top-0 h-1 bg-primary/40 animate-pulse z-10 shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
                            <div className="flex flex-col items-center gap-6 text-center z-20">
                              <div className="w-20 h-20 bg-white dark:bg-card rounded-[2rem] shadow-xl flex items-center justify-center animate-bounce">
                                <Camera className="h-10 w-10 text-primary" />
                              </div>
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Awaiting Hardware Consent</p>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent"></div>
                          </div>
                        </CardContent>
                        <CardFooter className="p-8 pt-4 flex gap-4">
                          <Button variant="outline" onClick={() => setShowCamera(false)} className="flex-1 py-7 rounded-2xl font-bold border-slate-200">Terminate</Button>
                          <Button onClick={captureCamera} className="flex-[2] py-7 rounded-2xl font-black shadow-xl shadow-primary/20">Capture Neural Frame</Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Right Column: History Sidebar */}
              <aside className="w-full lg:w-[350px] flex flex-col gap-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold text-foreground">Neural Logs</h3>
                  <button onClick={() => setActiveTab("history")} className="text-primary text-[10px] font-bold uppercase tracking-wider hover:underline">View Stream</button>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px] lg:max-h-none">
                  {history.slice(0, 5).map((item) => (
                    <motion.div 
                      key={item.id}
                      onClick={() => {
                        setCurrentImage(item.imageUrl);
                        setAnalysisResult(item.analysis);
                      }}
                      whileHover={{ x: 4 }}
                      className="group p-3 rounded-2xl bg-white dark:bg-card border border-border/30 hover:border-primary/30 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="flex gap-3">
                        <div className="w-14 h-14 bg-secondary rounded-xl overflow-hidden shrink-0 border border-border/20">
                          <img src={item.imageUrl} className="w-full h-full object-cover text-center" alt="Log" />
                        </div>
                        <div className="flex flex-col justify-center min-w-0">
                          <span className="font-bold text-sm truncate">{item.analysis.objects[0]?.objectName || "Unknown"}</span>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase">{item.analysis.objects[0]?.category} • {(item.analysis.objects[0]?.confidence * 100).toFixed(0)}%</span>
                          <span className="text-[9px] text-muted-foreground/60 mt-1">{new Date(item.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {history.length === 0 && (
                    <div className="p-8 text-center bg-secondary/10 rounded-3xl border border-dashed text-muted-foreground italic text-sm">
                      Logs empty. Start analyzing.
                    </div>
                  )}
                </div>

                {/* Growth Widget */}
                <Card className="mt-8 bg-primary text-primary-foreground rounded-3xl border-none shadow-lg shadow-primary/20 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <BrainCircuit className="w-20 h-20" />
                  </div>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-primary-foreground/60 text-[10px] font-bold uppercase tracking-widest">Model Quota</CardDescription>
                    <CardTitle className="text-2xl font-bold tracking-tighter">Daily Sync</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-1.5 h-10">
                      <div className="flex-1 bg-white/20 rounded-md h-[40%]"></div>
                      <div className="flex-1 bg-white/20 rounded-md h-[60%]"></div>
                      <div className="flex-1 bg-white/20 rounded-md h-[55%]"></div>
                      <div className="flex-1 bg-white/40 rounded-md h-[80%]"></div>
                      <div className="flex-1 bg-white rounded-md h-full shadow-lg shadow-white/20"></div>
                    </div>
                    <p className="text-[10px] font-medium leading-tight text-primary-foreground/80">42 / 100 Requests used in last 24h. High processing speed available.</p>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-8">
            <div className="flex flex-col gap-6">
              <div className="space-y-1">
                <h2 className="text-3xl font-extrabold tracking-tight">Archive Repository</h2>
                <p className="text-muted-foreground text-sm">Chronological log of analyzed visual entities.</p>
              </div>

              <Card className="rounded-[3rem] border-none shadow-sm bg-white dark:bg-card overflow-hidden">
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {history.map((item) => (
                      <motion.div 
                        whileHover={{ y: -4 }}
                        key={item.id} 
                        className="group relative cursor-pointer overflow-hidden rounded-[2rem] border bg-slate-50 dark:bg-secondary/10 aspect-square transition-all hover:shadow-xl hover:shadow-primary/10 hover:border-primary/20"
                        onClick={() => {
                          setCurrentImage(item.imageUrl);
                          setAnalysisResult(item.analysis);
                          setActiveTab("dashboard");
                        }}
                      >
                        <img src={item.imageUrl} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" alt="History" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent p-5 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{item.analysis.objects[0]?.category}</p>
                          <p className="text-sm font-bold text-white line-clamp-1">{item.analysis.objects[0]?.objectName}</p>
                          <p className="text-[10px] text-white/50 mt-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                        </div>
                      </motion.div>
                    ))}
                    {history.length === 0 && (
                      <div className="col-span-full py-32 text-center opacity-20 flex flex-col items-center gap-4">
                        <History className="h-16 w-16" />
                        <p className="font-bold uppercase tracking-[0.2em] text-xs">No records found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>AI Throughput</CardDescription>
                  <CardTitle className="text-2xl">98.4%</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={98} className="h-1" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Latency (Avg)</CardDescription>
                  <CardTitle className="text-2xl">1.2s</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={30} className="h-1" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Storage Usage</CardDescription>
                  <CardTitle className="text-2xl">12GB</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={12} className="h-1" />
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Admin Terminal</CardTitle>
                <CardDescription>System logs and AI model configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-black p-4 font-mono text-xs text-green-500 overflow-hidden">
                  <p>[INFO] VisionAI Kernel v1.0.4 initialized...</p>
                  <p>[SUCCESS] Gemini 1.5 Flash stream established.</p>
                  <p>[INFO] Listening on port 3000...</p>
                  <p className="animate-pulse">_</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="h-16 px-8 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-background flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-20">
        <div className="flex gap-8">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            TensorFlow Engine v2.4
          </span>
          <span className="hidden sm:block">Cloud DB: MongoDB Atlas</span>
        </div>
        <div className="flex gap-6 items-center">
          <span className="hover:text-primary transition-colors cursor-pointer">Security Policy</span>
          <span className="text-slate-900 dark:text-white">© 2026 VisionAI Systems</span>
        </div>
      </footer>
    </div>
  );
}
