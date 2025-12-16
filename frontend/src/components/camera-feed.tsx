"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Camera, AlertTriangle, Video } from "lucide-react"

export function CameraFeed() {
    const [cameraUrl, setCameraUrl] = useState<string>("")
    const [isLive, setIsLive] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)

    useEffect(() => {
        const url = localStorage.getItem("camera_url")
        if (url) {
            setCameraUrl(url)
            // If it's HTTP, we assume it might be live.
            // If it's "0" or "webcam", we use local webcam.
            if (url.startsWith("http")) {
                setIsLive(true)
            } else if (url === "0" || url.toLowerCase() === "webcam") {
                startWebcam()
            }
        }

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
                setIsLive(true)
            }
        } catch (err) {
            console.error("Error accessing webcam:", err)
            setIsLive(false)
        }
    }

    if (!cameraUrl) {
        return (
            <Card className="col-span-4 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <Camera className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Camera Feed Configured</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        Please configure a camera URL in settings to enable live monitoring and AI analytics.
                    </p>
                </CardContent>
            </Card>
        )
    }

    const isWebcam = cameraUrl === "0" || cameraUrl.toLowerCase() === "webcam"

    return (
        <Card className="col-span-4 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Live Camera Feed</CardTitle>
                {isLive ? (
                    <Badge variant="default" className="bg-red-500 hover:bg-red-600 animate-pulse">
                        LIVE - AI PROCESSING
                    </Badge>
                ) : (
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">Offline</Badge>
                        {isWebcam && (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={startWebcam}>
                                Retry Camera
                            </Button>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-0">
                <div className="relative aspect-video bg-black w-full flex items-center justify-center group">
                    {cameraUrl.startsWith('http') ? (
                        <>
                            <img
                                src={cameraUrl}
                                alt="Live Feed"
                                className="w-full h-full object-contain"
                                onError={() => setIsLive(false)}
                            />
                            {/* Overlay for AI Bounding Boxes (Mock) */}
                            {isLive && (
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute top-1/4 left-1/4 w-24 h-48 border-2 border-green-500 rounded flex items-start justify-center">
                                        <span className="bg-green-500 text-black text-[10px] px-1 font-bold">Person 92%</span>
                                    </div>
                                    <div className="absolute top-1/3 left-1/2 w-24 h-48 border-2 border-green-500 rounded flex items-start justify-center">
                                        <span className="bg-green-500 text-black text-[10px] px-1 font-bold">Person 88%</span>
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <div className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                            Detected: 2 People | Queue Density: Low
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : isWebcam ? (
                        <div className="relative w-full h-full group">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-contain"
                            />
                            {!isLive && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                                    <Button onClick={startWebcam} variant="secondary">
                                        <Camera className="mr-2 h-4 w-4" />
                                        Start Camera
                                    </Button>
                                </div>
                            )}
                            {/* Overlay for AI Bounding Boxes (Mock for Webcam) */}
                            {isLive && (
                                <div className="absolute inset-0 pointer-events-none z-10">
                                    <div className="absolute top-1/4 left-1/4 w-24 h-48 border-2 border-green-500 rounded flex items-start justify-center">
                                        <span className="bg-green-500 text-black text-[10px] px-1 font-bold">Person 92%</span>
                                    </div>
                                    <div className="absolute top-1/3 left-1/2 w-24 h-48 border-2 border-green-500 rounded flex items-start justify-center">
                                        <span className="bg-green-500 text-black text-[10px] px-1 font-bold">Person 88%</span>
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <div className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                            Detected: 2 People | Queue Density: Low
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center p-8">
                            <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-white font-medium mb-1">RTSP Stream Active</p>
                            <p className="text-xs text-zinc-400 font-mono mb-4">{cameraUrl}</p>
                            <div className="bg-zinc-900 border border-zinc-800 rounded p-4 max-w-md mx-auto text-left">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                    <p className="text-xs text-zinc-300">Browser Playback Not Supported</p>
                                </div>
                                <p className="text-xs text-zinc-500">
                                    RTSP streams are being processed by the backend AI engine.
                                    Analytics results will appear in the dashboard metrics.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
