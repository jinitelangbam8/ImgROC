import React, { useState, useCallback, useEffect, useRef } from "react";
import { Upload, Camera, ImageIcon, History, Layers, Info, Sun, Moon, Database, Settings, LayoutDashboard, BrainCircuit, ScanSearch, ExternalLink, Globe, User, LogOut, BookOpen, ShieldCheck, Zap, Cpu, Volume2, Languages, X, RotateCcw, Octagon, Trash2 } from "lucide-react";
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
import imageCompression from "browser-image-compression";
import { Toaster, toast } from "sonner";
import { analyzeImage, VisionAnalysis, generateSpeech } from "@/services/geminiService";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { auth, signInWithGoogle, logout, db } from "@/lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, orderBy, limit, Timestamp, deleteDoc, doc } from "firebase/firestore";

// Error reporting enum
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalysis | null>(null);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCamera, setShowCamera] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string | null>(null);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  // Auth listener & History fetcher
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const q = query(
            collection(db, "scans"),
            where("userId", "==", currentUser.uid),
            orderBy("timestamp", "desc"),
            limit(20)
          );
          const querySnapshot = await getDocs(q);
          const firestoreHistory: ScanHistory[] = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as ScanHistory));
          setHistory(firestoreHistory);
        } catch (error) {
          console.error("Firestore fetch error:", error);
          // Fallback to local storage if firestore fails
          const saved = localStorage.getItem("vision_history");
          if (saved) setHistory(JSON.parse(saved));
        }
      } else {
        const saved = localStorage.getItem("vision_history");
        if (saved) setHistory(JSON.parse(saved));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      toast.success("Identity verified. Access granted.");
    } catch (error) {
      toast.error("Authentication failed.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.info("Session terminated.");
    } catch (error) {
      toast.error("Logout failed.");
    }
  };

  // Theme application
  useEffect(() => {
    const saved = localStorage.getItem("vision_history");
    if (saved) setHistory(JSON.parse(saved));
    
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentlySpeakingText(null);
  };

  const speakResult = async (text: string) => {
    if (isSpeaking) {
      const wasSpeakingSameText = currentlySpeakingText === text;
      stopSpeaking();
      // If we clicked a NEW text while speaking another, we stop the old one and start the new one
      // If we clicked the SAME text, we just stop.
      if (wasSpeakingSameText) return;
    }
    
    setIsSpeaking(true);
    setCurrentlySpeakingText(text);
    try {
      const base64Audio = await generateSpeech(text);
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentlySpeakingText(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setCurrentlySpeakingText(null);
        audioRef.current = null;
        toast.error("Audio playback error");
      };
      await audio.play();
    } catch (error) {
      console.error("AI Speech failed, falling back to Web Speech API", error);
      // Fallback to Web Speech API
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentlySpeakingText(null);
        audioRef.current = null;
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const viewHistoryItem = (item: ScanHistory) => {
    setCurrentImage(item.imageUrl);
    setAnalysisResult(item.analysis);
    setActiveTab("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Restored neural diagnostic from logs.");
  };

  const deleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to terminate this record from history?")) return;
    
    try {
      if (user) {
        await deleteDoc(doc(db, "scans", id));
      }
      
      const newHistory = history.filter(item => item.id !== id);
      setHistory(newHistory);
      localStorage.setItem("vision_history", JSON.stringify(newHistory));
      toast.success("Record purged from neural logs.");
    } catch (error) {
      toast.error("Failed to delete record.");
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
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false
  } as any);

  const clearImage = () => {
    setCurrentImage(null);
    setAnalysisResult(null);
  };

  const performAnalysis = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    try {
      // Compress image before sending to backend to speed up network transfer
      const res = await fetch(`data:${mimeType};base64,${base64}`);
      const blob = await res.blob();
      const file = new File([blob], "input.jpg", { type: mimeType });
      
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);
      const reader = new FileReader();
      const compressedBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(compressedFile);
      });

      const result = await analyzeImage(compressedBase64, compressedFile.type);
      setAnalysisResult(result);
      
      const newHistoryItem: any = {
        userId: user?.uid || "anonymous",
        timestamp: Date.now(),
        imageUrl: `data:${compressedFile.type};base64,${compressedBase64}`,
        analysis: result
      };
      
      if (user) {
        try {
          const docRef = await addDoc(collection(db, "scans"), newHistoryItem);
          newHistoryItem.id = docRef.id;
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, "scans");
        }
      } else {
        newHistoryItem.id = Math.random().toString(36).substr(2, 9);
      }
      
      const updatedHistory = [newHistoryItem, ...history.slice(0, 19)];
      setHistory(updatedHistory);
      
      if (!user) {
        localStorage.setItem("vision_history", JSON.stringify(updatedHistory));
      }
      
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
    <div className={`min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary transition-colors duration-500`}>
      <Toaster position="top-right" richColors />
      
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary/20 blur-[120px] rounded-full animate-pulse delay-700"></div>
      </div>

      <header className="sticky top-0 z-50 glass border-b border-white/10 px-6 h-18 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-linear-to-br from-primary to-secondary p-2 rounded-xl glow-primary">
            <ScanSearch className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-gradient">
            ImgREC
          </h1>
        </div>

        <nav className="hidden lg:flex items-center gap-1 bg-muted/50 p-1 rounded-2xl border border-white/5">
          {["Dashboard", "History", "Documentation", "Profile", "System"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase() as any)}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                activeTab === tab.toLowerCase()
                  ? "bg-white dark:bg-card shadow-lg text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <button 
              onClick={() => setActiveTab("profile")}
              className="flex items-center gap-3 bg-muted/30 p-1.5 pr-4 rounded-full border border-white/5 hover:bg-muted/50 transition-all group"
            >
              <img src={user.photoURL || ""} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/20 group-hover:border-primary/50 transition-all" />
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-[10px] font-black uppercase tracking-tight truncate max-w-[80px]">{user.displayName}</span>
                <span className="text-[7px] font-bold text-muted-foreground uppercase">Verified</span>
              </div>
            </button>
          ) : (
            <Button 
              onClick={handleLogin} 
              variant="outline" 
              className="rounded-full px-6 h-10 text-[10px] font-black uppercase tracking-widest border-primary/20 hover:bg-primary/10 text-primary transition-all"
            >
              <User className="mr-2 h-4 w-4" />
              Access Portal
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">System Status</span>
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Operational
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 relative z-10">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-12 space-y-12">
          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <div className="flex flex-col lg:flex-row gap-10 pb-12">
              {/* Left Column: Active Session */}
              <div className="flex-1 flex flex-col gap-8">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-2 px-2"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-[1px] w-8 bg-primary"></span>
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Neural Interface</h2>
                  </div>
                  <h1 className="text-5xl font-black tracking-tight leading-tight">
                    Object <span className="text-gradient">Intelligence</span>
                  </h1>
                  <p className="text-muted-foreground text-sm max-w-md">
                    Execute real-time identification with advanced neural processing and deep metric extraction.
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 gap-8">
                  {/* Analysis Viewport */}
                  <Card className="rounded-4xl glow-primary border-white/10 overflow-hidden flex flex-col min-h-[650px] bg-white/50 dark:bg-card/50 backdrop-blur-2xl transition-all">
                    <div {...getRootProps()} className={cn(
                      "relative flex-1 bg-slate-100/50 dark:bg-black/40 flex items-center justify-center p-10 min-h-[450px] cursor-pointer transition-all hover:bg-slate-200/50 dark:hover:bg-black/50",
                      isDragActive && "bg-primary/10 scale-[0.98]"
                    )}>
                      <input {...getInputProps()} />
                      
                      {currentImage ? (
                        <div className="relative z-20 w-full h-full flex items-center justify-center pointer-events-none">
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative"
                          >
                            <img src={currentImage} className="max-h-[400px] w-auto rounded-3xl shadow-2xl border-4 border-white/20" alt="Preview" />
                            
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="absolute -top-3 -right-3 rounded-full h-8 w-8 shadow-xl border-2 border-background pointer-events-auto z-40 hover:scale-110 transition-transform"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearImage();
                                toast.info("Neural workspace cleared.");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            
                            {/* Scanning Effect Overlay */}
                            {isAnalyzing && (
                              <motion.div 
                                animate={{ top: ["0%", "100%", "0%"] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="absolute left-0 right-0 h-1 bg-primary glow-primary z-30"
                              />
                            )}

                            {/* OCR Text Overlay */}
                            {analysisResult?.ocrText && (
                              <div className="absolute -bottom-6 left-6 right-6 glass p-4 rounded-2xl text-[11px] text-foreground/90 italic shadow-xl">
                                <span className="font-black text-primary mr-2 uppercase tracking-widest text-[9px]">Text Output</span>
                                "{analysisResult.ocrText}"
                              </div>
                            )}
                          </motion.div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-center space-y-8 z-20 pointer-events-none">
                          <div className="w-24 h-24 bg-white dark:bg-card rounded-4xl shadow-2xl flex items-center justify-center transition-all hover:scale-110 glow-primary border border-white/20">
                            <Upload className="h-10 w-10 text-primary" />
                          </div>
                          <div className="space-y-3">
                            <p className="font-black text-3xl tracking-tight uppercase">Neural Input</p>
                            <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed">
                              Inject visual assets into the matrix for classification and processing.
                            </p>
                          </div>
                          <div className="flex gap-4">
                            <Button size="lg" className="rounded-2xl px-10 border-primary/20 bg-primary/10 text-primary font-black hover:bg-primary transition-all hover:text-white glow-primary">
                              UPLOAD FILE
                            </Button>
                          </div>
                        </div>
                      )}

                      {isAnalyzing && (
                        <div className="absolute inset-0 z-30 bg-white/80 dark:bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center space-y-8">
                          <div className="relative">
                            <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-10 h-10 border-4 border-secondary border-b-transparent rounded-full animate-spin-reverse"></div>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="font-black text-primary animate-pulse uppercase tracking-[0.4em] text-[10px]">Processing Vision Matrix</p>
                            <p className="text-[10px] text-muted-foreground mt-2 font-mono">ENCRYPTING TENSOR FIELDS...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-10 glass border-t border-white/10">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="font-black text-xl tracking-tight">Detection Stream</h3>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">Live Extraction Feed</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-xl px-4 border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest h-10 transition-all font-mono"
                            onClick={clearImage}
                          >
                            <RotateCcw className="mr-2 h-3 w-3" />
                            Reset System
                          </Button>
                          <Badge variant="outline" className="rounded-xl font-mono text-[11px] font-black py-1.5 px-3 border-primary text-primary glow-primary bg-primary/5">0.82ms/img</Badge>
                        </div>
                      </div>
                      
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="flex flex-col gap-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {analysisResult?.objects.map((obj, i) => (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={i} 
                                className="flex flex-col p-5 bg-white/40 dark:bg-white/5 rounded-3xl border border-white/10 group hover:border-primary/50 transition-all hover:shadow-xl hover:bg-white/60"
                              >
                                <div className="flex items-start justify-between min-w-0">
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] uppercase font-black text-primary tracking-widest font-mono opacity-70">{obj.category}</span>
                                      <span className="text-[7px] font-bold text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded border border-white/10 uppercase">ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                                    </div>
                                    <span className="font-black text-lg truncate leading-tight">{obj.objectName}</span>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0">
                                    <span className="text-primary font-mono font-black text-xl leading-none">
                                      {(obj.confidence * 100).toFixed(0)}%
                                    </span>
                                    <span className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Confidence</span>
                                  </div>
                                </div>
                                {obj.description && (
                                  <p className="text-xs text-muted-foreground mt-3 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                                    {obj.description}
                                  </p>
                                )}
                                
                                <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                                    <span className="text-muted-foreground">Neural Origin</span>
                                    <span className="text-foreground">Distributed Index</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                                    <span className="text-muted-foreground">Classification</span>
                                    <span className="text-foreground">{obj.category}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 mt-4">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = obj.searchUrl || `https://www.google.com/search?q=${encodeURIComponent(obj.objectName + " " + (obj.category || ""))}`;
                                      window.open(url, "_blank");
                                    }}
                                  >
                                    <Globe className="h-3 w-3 mr-1.5" />
                                    Deep Search
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                      "h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm",
                                      isSpeaking && currentlySpeakingText === obj.description && "bg-destructive/10 text-destructive hover:bg-destructive"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (obj.description) speakResult(obj.description);
                                    }}
                                  >
                                    {isSpeaking && currentlySpeakingText === obj.description ? (
                                      <Octagon className="h-3 w-3 mr-1.5 animate-pulse" />
                                    ) : (
                                      <Volume2 className="h-3 w-3 mr-1.5" />
                                    )}
                                    {isSpeaking && currentlySpeakingText === obj.description ? "Stop Info" : "Voice Info"}
                                  </Button>
                                </div>
                              </motion.div>
                            ))}
                            {!analysisResult && !isAnalyzing && (
                              <div className="col-span-full py-12 text-center opacity-30 flex flex-col items-center gap-4">
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-primary animate-spin-slow"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Neural Data</p>
                              </div>
                            )}
                          </div>

                          {analysisResult?.sources && analysisResult.sources.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="p-6 rounded-3xl glass border border-white/10"
                            >
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                                <Globe className="h-3 w-3" />
                                Verified Web Sources
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {analysisResult.sources.map((source, idx) => (
                                  <a 
                                    key={idx}
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 rounded-xl bg-white/20 dark:bg-white/5 border border-white/10 text-[10px] font-bold text-foreground/80 hover:bg-primary/20 hover:border-primary/40 hover:text-primary transition-all flex items-center gap-2"
                                  >
                                    <span className="truncate max-w-[150px]">{source.title}</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                        
                        {analysisResult?.summary && (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-8 p-6 rounded-3xl bg-primary/10 border border-primary/20 relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-2 opacity-20">
                              <Layers className="h-10 w-10 text-primary" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center justify-between">
                              Executive Summary
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className={cn(
                                  "h-6 px-2 rounded-lg text-[8px] font-black uppercase tracking-wider bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all",
                                  isSpeaking && currentlySpeakingText === analysisResult.summary && "bg-destructive/20 text-destructive hover:bg-destructive"
                                )}
                                onClick={() => speakResult(analysisResult.summary)}
                              >
                                {isSpeaking && currentlySpeakingText === analysisResult.summary ? (
                                  <Octagon className="h-2.5 w-2.5 mr-1 animate-pulse" />
                                ) : (
                                  <Volume2 className="h-2.5 w-2.5 mr-1" />
                                )}
                                {isSpeaking && currentlySpeakingText === analysisResult.summary ? "Stop" : "Listen"}
                              </Button>
                            </h4>
                            <p className="text-sm leading-relaxed text-foreground font-medium">{analysisResult.summary}</p>
                          </motion.div>
                        )}
                      </ScrollArea>
                    </div>
                  </Card>

                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row gap-5">
                    <Button 
                      size="lg" 
                      className="flex-1 py-10 rounded-3xl shadow-2xl shadow-primary/30 text-xl font-black bg-primary hover:bg-primary/90 glow-primary transition-all active:scale-95"
                      onClick={() => setShowCamera(true)}
                    >
                      <Camera className="mr-3 h-7 w-7" />
                      LIVE OPTICAL SCAN
                    </Button>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="px-12 py-10 rounded-3xl font-black bg-white/40 dark:bg-white/5 border-white/20 hover:bg-white/60 transition-all text-foreground text-base tracking-tight"
                      onClick={() => analysisResult && speakResult(analysisResult.summary)}
                      disabled={!analysisResult}
                    >
                      AUDIT LOG
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
                    className="fixed inset-0 z-[100] flex items-center justify-center glass p-6"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="w-full max-w-xl"
                    >
                      <Card className="border-white/10 shadow-2xl rounded-4xl overflow-hidden bg-white/60 dark:bg-card/60 backdrop-blur-3xl glow-primary">
                        <CardHeader className="p-8 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-3xl font-black tracking-tight leading-none text-gradient">Optical Capture</CardTitle>
                              <CardDescription className="text-[10px] font-black uppercase tracking-[0.3em] text-primary opacity-70">Neural Stream Establishing...</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowCamera(false)} className="rounded-full hover:bg-primary/10 transition-colors">
                              <History className="h-5 w-5 rotate-45 text-primary" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-8 pb-4">
                          <div className="aspect-video w-full bg-slate-100/50 dark:bg-black/40 rounded-3xl flex items-center justify-center border border-primary/20 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-linear-to-b from-primary/5 to-transparent pointer-events-none"></div>
                            <motion.div 
                              animate={{ top: ["0%", "100%", "0%"] }} 
                              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              className="absolute left-0 right-0 h-0.5 bg-primary/40 glow-primary z-10"
                            />
                            <div className="flex flex-col items-center gap-6 text-center z-20">
                              <div className="w-24 h-24 bg-white dark:bg-card rounded-4xl shadow-2xl flex items-center justify-center animate-pulse glow-primary border border-white/20">
                                <Camera className="h-10 w-10 text-primary" />
                              </div>
                              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Awaiting Hardware Consent</p>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="p-8 pt-4 flex gap-4">
                          <Button variant="outline" onClick={() => setShowCamera(false)} className="flex-1 py-8 rounded-2xl font-black border-white/20 hover:bg-white/40 transition-all text-xs uppercase tracking-widest">Terminate</Button>
                          <Button onClick={captureCamera} className="flex-[2] py-8 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary glow-primary hover:bg-primary/90 transition-all active:scale-95">Capture Matrix</Button>
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

                <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] lg:max-h-none pr-2">
                  <AnimatePresence mode="popLayout">
                    {history.slice(0, 5).map((item, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={item.id}
                        onClick={() => viewHistoryItem(item)}
                        className="group p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/10 hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:bg-white/60 dark:hover:bg-white/10"
                      >
                        <div className="flex gap-4">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10 relative">
                            <img src={item.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Log" />
                            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-full h-1 bg-primary rounded-full glow-primary"></div>
                            </div>
                          </div>
                          <div className="flex flex-col justify-center min-w-0 flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-black text-sm truncate leading-tight">{item.analysis.objects[0]?.objectName || "Unknown"}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-primary font-mono">{(item.analysis.objects[0]?.confidence * 100).toFixed(0)}%</span>
                                <button 
                                  onClick={(e) => deleteHistoryItem(e, item.id)}
                                  className="p-1 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">{item.analysis.objects[0]?.category}</span>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></span>
                              <span className="text-[8px] text-muted-foreground/60 font-bold tracking-tighter uppercase">{new Date(item.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {history.length === 0 && (
                    <div className="p-12 text-center bg-white/40 dark:bg-white/5 rounded-4xl border border-dashed border-white/20 text-muted-foreground italic text-xs flex flex-col items-center gap-3">
                      <History className="h-6 w-6 opacity-30" />
                      <p className="font-black uppercase tracking-widest text-[10px]">Data Stream Empty</p>
                    </div>
                  )}
                </div>

                {/* Growth Widget */}
                <Card className="mt-8 bg-linear-to-br from-primary via-secondary to-primary bg-[length:200%_200%] animate-gradient text-white rounded-4xl border-none glow-primary overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-6 opacity-20 rotate-12">
                    <BrainCircuit className="w-24 h-24" />
                  </div>
                  <CardHeader className="pb-2 relative z-10">
                    <CardDescription className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em]">Neural Capacity</CardDescription>
                    <CardTitle className="text-3xl font-black tracking-tighter">System Health</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 relative z-10">
                    <div className="flex items-end gap-2 h-14">
                      {[0.4, 0.6, 0.5, 0.8, 1, 0.7, 0.9].map((h, i) => (
                        <div key={i} className="flex-1 bg-white/20 rounded-lg transition-all hover:bg-white/40" style={{ height: `${h * 100}%` }}></div>
                      ))}
                    </div>
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
                      <p className="text-[10px] font-black leading-relaxed uppercase tracking-widest">
                        Throughput: <span className="text-white">4.2 GB/s</span>
                        <br />
                        Efficiency: <span className="text-white">99.8%</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-12 focus-visible:outline-none">
            <div className="flex flex-col gap-10">
              <div className="space-y-3 px-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-[1px] w-8 bg-primary"></span>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Storage Hub</h2>
                </div>
                <h1 className="text-5xl font-black tracking-tight leading-tight text-gradient">Archive Repository</h1>
                <p className="text-muted-foreground text-sm max-w-xl">Deep archives of all successful visual extractions and AI classification logs.</p>
              </div>

              <Card className="rounded-4xl border-white/10 shadow-xl bg-white/40 dark:bg-card/40 backdrop-blur-3xl overflow-hidden p-8">
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                    {history.map((item, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ y: -8, scale: 1.02 }}
                        key={item.id} 
                        className="group relative cursor-pointer overflow-hidden rounded-4xl border border-white/10 bg-slate-50 dark:bg-white/5 aspect-square transition-all hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40 glow-primary"
                        onClick={() => viewHistoryItem(item)}
                      >
                        <img src={item.imageUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-125" alt="History" />
                        <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/10 to-transparent p-6 flex flex-col justify-end translate-y-4 group-hover:translate-y-0 transition-transform">
                          <button 
                            onClick={(e) => deleteHistoryItem(e, item.id)}
                            className="absolute top-4 right-4 p-2 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white rounded-xl backdrop-blur-md border border-destructive/20 opacity-0 group-hover:opacity-100 transition-all z-20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">{item.analysis.objects[0]?.category}</p>
                            <p className="text-sm font-black text-white leading-tight">{item.analysis.objects[0]?.objectName}</p>
                            <div className="flex items-center justify-between mt-3">
                              <p className="text-[9px] font-bold text-white/50 uppercase tracking-tighter">{new Date(item.timestamp).toLocaleDateString()}</p>
                              <div className="px-2 py-1 bg-primary/20 rounded-lg border border-primary/30">
                                <span className="text-[8px] font-black text-primary">{(item.analysis.objects[0]?.confidence * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {history.length === 0 && (
                      <div className="col-span-full py-40 text-center opacity-20 flex flex-col items-center gap-6">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center border-4 border-dashed border-muted-foreground/30 animate-spin-slow">
                          <History className="h-8 w-8" />
                        </div>
                        <p className="font-black uppercase tracking-[0.3em] text-[10px]">Matrix Logs: EMPTY</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="documentation" className="mt-12 focus-visible:outline-none">
            <div className="flex flex-col gap-12 max-w-5xl mx-auto pb-20">
              <div className="space-y-4 text-center">
                <Badge variant="outline" className="rounded-full px-4 py-1 border-primary/20 bg-primary/5 text-primary font-black uppercase tracking-[0.2em] text-[10px]">Technical Specs</Badge>
                <h1 className="text-6xl font-black tracking-tighter leading-none text-gradient">System Documentation</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Complete guide to the ImgREC neural architecture, API integration, and security protocols.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-4xl glass border-white/10 p-8 shadow-xl">
                  <CardHeader className="p-0 pb-6 flex flex-row items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black">Core Engine</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Neural Processing</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      ImgREC utilizes <span className="text-foreground font-bold">Gemini 1.5 Flash</span>, optimized for rapid vision-language reasoning. The engine performs asynchronous multi-modal analysis, extracting feature vectors from visual inputs.
                    </p>
                    <ul className="space-y-3">
                      {[
                        "Real-time object classification (>98% accuracy)",
                        "Multilingual OCR with automatic script detection",
                        "Deep Neural Grounding for personal & brand details",
                        "Direct integration with Google Knowledge Graph",
                        "Sub-500ms latency on edge nodes"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-xs font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="rounded-4xl glass border-white/10 p-8 shadow-xl">
                  <CardHeader className="p-0 pb-6 flex flex-row items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Languages className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black">Neural Grounding</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Entity Identification</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Beyond mere recognition, ImgREC provides <span className="text-foreground font-bold">Neural Grounding</span>. By referencing distributed search indexes, it identifies specific models, origins, and technical IDs.
                    </p>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase text-emerald-500">Search Accuracy</span>
                        <Badge className="bg-emerald-500 text-white font-black text-[9px] uppercase">Enterprise</Badge>
                      </div>
                      <Progress value={94} className="h-1 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-4xl glass border-white/10 p-8 shadow-xl">
                  <CardHeader className="p-0 pb-6 flex flex-row items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black">Security Protocol</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Access Control</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      All neural streams are protected via <span className="text-foreground font-bold">Firebase Identity Platform</span>. Data is encrypted at rest using AES-256 and transit via TLS 1.3.
                    </p>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase text-secondary">Auth Level</span>
                        <Badge className="bg-secondary text-white font-black text-[9px] uppercase">Level 4</Badge>
                      </div>
                      <Progress value={100} className="h-1 bg-secondary/10" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-4xl glass border-white/10 p-8 shadow-xl md:col-span-2">
                  <CardHeader className="p-0 pb-8">
                    <div className="flex items-center gap-4 mb-2">
                      <Cpu className="w-5 h-5 text-primary" />
                      <CardTitle className="text-2xl font-black">Processing Pipeline</CardTitle>
                    </div>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em]">Operational Workflow</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                      {[
                        { title: "Ingestion", desc: "Binary visual data passed through edge compression filters." },
                        { title: "Inference", desc: "Gemini-1.5-Flash opt-model executes visual feature extraction." },
                        { title: "Grounding", desc: "Cross-referencing entities via distributed search indexes." }
                      ].map((step, i) => (
                        <div key={i} className="space-y-3 relative z-10">
                          <span className="text-4xl font-black text-primary/20">0{i+1}</span>
                          <h5 className="font-black text-lg">{step.title}</h5>
                          <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-4xl bg-slate-900 border-none p-10 md:col-span-2 text-white overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12">
                    <BookOpen className="w-40 h-40" />
                  </div>
                  <div className="space-y-6 relative z-10">
                    <h3 className="text-3xl font-black tracking-tight">API Interface</h3>
                    <p className="text-white/60 text-sm max-w-xl">Developers can integrate the ImgREC engine into custom applications using our standardized SDK endpoints.</p>
                    <div className="bg-black/40 rounded-2xl p-6 font-mono text-[11px] text-emerald-400 border border-white/10">
                      <p className="text-white/40">// Initialize ImgREC SDK</p>
                      <p>const <span className="text-primary">imgrec</span> = new <span className="text-white">ImgREC</span>({'{'} apiKey: SYNC_KEY {'}'});</p>
                      <p className="mt-4 text-white/40">// Execute deep analysis</p>
                      <p>const result = await <span className="text-primary">imgrec</span>.<span className="text-white">analyze</span>(imageBuffer);</p>
                      <p className="mt-4 text-white/40">// Output results</p>
                      <p>console.log(result.<span className="text-white">prediction</span>);</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-12 focus-visible:outline-none">
            <div className="max-w-4xl mx-auto pb-20">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass rounded-4xl border border-white/10 overflow-hidden shadow-2xl"
              >
                <div className="h-48 bg-linear-to-r from-primary/30 via-secondary/30 to-primary/30 relative">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                </div>
                
                <div className="px-10 pb-12 relative">
                  <div className="flex flex-col md:flex-row gap-8 items-end -mt-20 mb-8">
                    <div className="relative">
                      <img src={user?.photoURL || ""} className="w-40 h-40 rounded-4xl border-8 border-background bg-muted object-cover shadow-2xl shadow-primary/20" alt="Profile" />
                      <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-2xl shadow-xl border-4 border-background">
                        <ShieldCheck className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-4 mb-2">
                        <h1 className="text-4xl font-black tracking-tight">{user?.displayName || "Anonymous Operative"}</h1>
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase text-[10px] tracking-widest px-3">Identity Verified</Badge>
                      </div>
                      <p className="text-muted-foreground font-mono text-sm">{user?.email}</p>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleLogout} variant="destructive" className="rounded-2xl px-6 font-black uppercase tracking-widest text-[10px] h-12 shadow-xl shadow-destructive/20">
                        <LogOut className="mr-2 h-4 w-4" />
                        Terminate Session
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-white/10">
                    <div className="p-6 rounded-3xl bg-muted/20 border border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary block mb-4">Neural Capacity</span>
                      <div className="flex items-end gap-2">
                        <span className="text-4xl font-black leading-none">{history.length}</span>
                        <span className="text-xs font-bold text-muted-foreground pb-1">Scans Total</span>
                      </div>
                      <Progress value={Math.min((history.length/50)*100, 100)} className="h-1.5 mt-6 bg-primary/10" />
                      <p className="text-[9px] font-bold text-muted-foreground mt-3 uppercase">Quota usage: {((history.length/50)*100).toFixed(0)}% of standard tier</p>
                    </div>
                    
                    <div className="p-6 rounded-3xl bg-muted/20 border border-white/5 col-span-2">
                      <h3 className="text-xl font-black mb-4 flex items-center gap-3">
                        <User className="w-5 h-5 text-primary" />
                        Identity Metadata
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unique Hash</span>
                          <p className="text-xs font-mono truncate">{user?.uid}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last Auth</span>
                          <p className="text-xs font-mono">{user?.metadata.lastSignInTime}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </TabsContent>

          <TabsContent value="system" className="mt-12 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <Card className="rounded-4xl border-white/10 glass p-8 shadow-xl glow-primary">
                <CardHeader className="p-0 pb-6">
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Neural Confidence</CardDescription>
                  <CardTitle className="text-4xl font-black tracking-tight mt-2">
                    {history.length > 0 
                      ? (history.reduce((acc, curr) => acc + (curr.analysis.objects[0]?.confidence || 0), 0) / history.length * 100).toFixed(1)
                      : "0"}%
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative h-2 bg-primary/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: history.length > 0 ? '98%' : '0' }}
                      className="absolute h-full bg-linear-to-r from-primary to-secondary glow-primary"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-4xl border-white/10 glass p-8 shadow-xl glow-secondary">
                <CardHeader className="p-0 pb-6">
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary">Cache Indexing</CardDescription>
                  <CardTitle className="text-4xl font-black tracking-tight mt-2">{history.length} <span className="opacity-40 text-xl font-bold">ENTRIES</span></CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative h-2 bg-secondary/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((history.length / 20) * 100, 100)}%` }}
                      className="absolute h-full bg-linear-to-r from-secondary to-primary glow-secondary"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-4xl border-white/10 glass p-8 shadow-xl">
                <CardHeader className="p-0 pb-6">
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Kernel Uptime</CardDescription>
                  <CardTitle className="text-4xl font-black tracking-tight mt-2 text-emerald-500">99.9%</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative h-2 bg-emerald-500/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '99%' }}
                      className="absolute h-full bg-emerald-500"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card className="rounded-[2.5rem] border-white/10 bg-slate-900 overflow-hidden shadow-2xl relative">
              <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-secondary to-primary glow-primary"></div>
              <CardHeader className="p-10">
                <CardTitle className="text-white flex items-center gap-3 text-2xl font-black tracking-tight">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse glow-primary"></div>
                  Neural Terminal v2.4
                </CardTitle>
                <CardDescription className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Real-time system diagnostics and IO throughput.</CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                <div className="rounded-3xl bg-black/60 p-8 font-mono text-[11px] text-emerald-400 overflow-hidden border border-white/5 min-h-[300px]">
                  <p className="opacity-40">[{new Date().toISOString()}] SYNCING_DISTRIBUTED_KERNELS...</p>
                  <p className="text-white mt-1">CORE_STATUS: <span className="text-emerald-500 font-black">HIGH_PERFORMANCE_MODE</span></p>
                  <p className="mt-1">AI_MODEL: <span className="text-primary font-black">GEMINI_1.5_FLASH_OPT</span></p>
                  <p className="mt-1">LATENCY: <span className="text-secondary font-black">214ms</span> | JITTER: 2ms</p>
                  {history.length > 0 && <p className="mt-4 text-emerald-300 animate-pulse font-bold">[DATA] CACHE_SYNC_COMPLETE: {history.length} ENTRIES MAPPED TO VOLATILE_STORAGE</p>}
                  <p className="mt-8 text-white/20">READY_FOR_NEUTRAL_INPUT...</p>
                  <p className="animate-pulse mt-2 text-primary">█</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="px-12 py-10 border-t border-white/10 glass flex flex-wrap items-center justify-between gap-8 mt-40 pb-24 md:pb-10">
        <div className="flex flex-wrap gap-12">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Engine Core</span>
            <span className="flex items-center gap-2.5 text-xs font-black">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse glow-primary"></span>
              TensorFlow v2.8-edge
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Neural Network</span>
            <span className="text-xs font-black">Gemini Pro Vision Engine</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Datastore</span>
            <span className="text-xs font-black">Atlas V-Cloud Partition</span>
          </div>
        </div>
        <div className="flex items-center gap-10">
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <span className="hover:text-primary transition-colors cursor-pointer">Security Protocol</span>
            <span className="hover:text-secondary transition-colors cursor-pointer">Data Privacy</span>
          </div>
          <div className="h-10 w-[1px] bg-white/10 hidden md:block"></div>
          <span className="text-xs font-black tracking-tight text-foreground/80">© 2026 ImgREC Systems</span>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10 px-6 py-3 pb-8 flex items-center justify-around shadow-2xl">
        {[
          { id: "dashboard", icon: LayoutDashboard, label: "Dash" },
          { id: "history", icon: History, label: "Logs" },
          { id: "documentation", icon: BookOpen, label: "Docs" },
          { id: "profile", icon: User, label: "User" }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === item.id ? "text-primary scale-110" : "text-muted-foreground opacity-60"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
