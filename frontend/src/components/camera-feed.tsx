"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Camera, AlertTriangle, Video, Loader2, Upload } from "lucide-react"
import { processVideoFrame, FrameDetectionResponse } from "@/api/aiApi"

export function CameraFeed() {
    const [isLive, setIsLive] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [sourceType, setSourceType] = useState<"camera" | "upload">("camera")
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("default")
    const [uploadedVideoName, setUploadedVideoName] = useState<string>("")
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const uploadInputRef = useRef<HTMLInputElement>(null)
    const uploadedVideoUrlRef = useRef<string | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const processingIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const [detectionData, setDetectionData] = useState<FrameDetectionResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const stopCurrentStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }

    const loadVideoDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const cameras = devices.filter(device => device.kind === "videoinput")
            setVideoDevices(cameras)
            if (cameras.length > 0 && !cameras.some(device => device.deviceId === selectedDeviceId)) {
                setSelectedDeviceId(cameras[0].deviceId)
            }
        } catch (err) {
            console.error("Failed to enumerate video devices:", err)
        }
    }

    useEffect(() => {
        if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
            void loadVideoDevices()
            navigator.mediaDevices.addEventListener("devicechange", loadVideoDevices)
        }

        return () => {
            stopProcessing()
            stopCurrentStream()
            if (uploadedVideoUrlRef.current) {
                URL.revokeObjectURL(uploadedVideoUrlRef.current)
                uploadedVideoUrlRef.current = null
            }
            if (typeof navigator !== "undefined" && navigator.mediaDevices?.removeEventListener) {
                navigator.mediaDevices.removeEventListener("devicechange", loadVideoDevices)
            }
        }
    }, [])

    const startWebcam = async () => {
        setIsStarting(true)
        setError(null)
        setSourceType("camera")
        try {
            stopCurrentStream()
            if (uploadedVideoUrlRef.current) {
                URL.revokeObjectURL(uploadedVideoUrlRef.current)
                uploadedVideoUrlRef.current = null
            }
            setUploadedVideoName("")
            if (videoRef.current) {
                videoRef.current.src = ""
                videoRef.current.srcObject = null
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    ...(selectedDeviceId !== "default" ? { deviceId: { exact: selectedDeviceId } } : {}),
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })
            await loadVideoDevices()
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
                setIsLive(true)
                videoRef.current.onloadedmetadata = () => {
                    startFrameProcessing()
                }
            } else {
                // Video element not ready yet — stop the stream
                stream.getTracks().forEach(track => track.stop())
                setError("Video element not ready. Please try again.")
            }
        } catch (err: any) {
            console.error("Error accessing webcam:", err)
            setIsLive(false)
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError("Camera permission denied. Please allow camera access in your browser settings and try again.")
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setError("No camera found. Please connect a camera and try again.")
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setError("Camera is already in use by another application.")
            } else {
                setError(`Failed to access camera: ${err.message || 'Unknown error'}`)
            }
        } finally {
            setIsStarting(false)
        }
    }

    const handleUploadVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (file.type !== "video/mp4") {
            setError("Please upload an MP4 video file.")
            event.target.value = ""
            return
        }

        setError(null)
        setSourceType("upload")
        stopCurrentStream()

        if (uploadedVideoUrlRef.current) {
            URL.revokeObjectURL(uploadedVideoUrlRef.current)
            uploadedVideoUrlRef.current = null
        }

        const objectUrl = URL.createObjectURL(file)
        uploadedVideoUrlRef.current = objectUrl
        setUploadedVideoName(file.name)

        if (videoRef.current) {
            videoRef.current.srcObject = null
            videoRef.current.src = objectUrl
            videoRef.current.currentTime = 0
            videoRef.current.onloadedmetadata = () => {
                setIsLive(true)
                startFrameProcessing()
            }
            try {
                await videoRef.current.play()
            } catch {
                // Browser may block autoplay depending on policy; user can press play controls.
            }
        }

        event.target.value = ""
    }

    const captureFrame = (): string | null => {
        if (!videoRef.current || !canvasRef.current) return null
        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.8)
    }

    const startFrameProcessing = () => {
        if (processingIntervalRef.current) return
        setIsProcessing(true)
        processingIntervalRef.current = setInterval(async () => {
            const frameData = captureFrame()
            if (!frameData) return
            try {
                const result = await processVideoFrame(frameData, selectedDeviceId || "webcam")
                setDetectionData(result)
                setError(null)
            } catch (err) {
                console.error("Frame processing error:", err)
                // Don't overwrite error - just log it, detection is optional
            }
        }, 1000)
    }

    useEffect(() => {
        if (!isLive || sourceType !== "camera") return
        void startWebcam()
    }, [selectedDeviceId, sourceType])

    const stopProcessing = () => {
        if (processingIntervalRef.current) {
            clearInterval(processingIntervalRef.current)
            processingIntervalRef.current = null
        }
        setIsProcessing(false)
        setDetectionData(null)
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Live Camera Feed</CardTitle>
                <div className="flex items-center gap-2">
                    <input
                        ref={uploadInputRef}
                        type="file"
                        accept="video/mp4"
                        aria-label="Upload MP4 video"
                        onChange={handleUploadVideo}
                        className="hidden"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => uploadInputRef.current?.click()}
                        className="h-8 gap-1"
                    >
                        <Upload className="h-3.5 w-3.5" />
                        Upload MP4
                    </Button>
                    <label htmlFor="camera-device" className="sr-only">Select camera</label>
                    <select
                        id="camera-device"
                        value={selectedDeviceId}
                        onChange={(event) => setSelectedDeviceId(event.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                        disabled={isStarting || sourceType === "upload"}
                    >
                        {videoDevices.length === 0 ? (
                            <option value="default">Default camera</option>
                        ) : (
                            videoDevices.map((device, index) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Camera ${index + 1}`}
                                </option>
                            ))
                        )}
                    </select>
                    {isLive && isProcessing ? (
                        <Badge variant="default" className="bg-red-500 hover:bg-red-600 animate-pulse">
                            {sourceType === "upload" ? "VIDEO - AI PROCESSING" : "LIVE - AI PROCESSING"}
                        </Badge>
                    ) : isLive ? (
                        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                            {sourceType === "upload" ? "VIDEO" : "LIVE"}
                        </Badge>
                    ) : (
                        <Badge variant="outline">Offline</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="relative aspect-video bg-black w-full flex items-center justify-center">
                    {/* Video & canvas are ALWAYS in the DOM so refs work */}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        controls={sourceType === "upload"}
                        muted={sourceType === "camera"}
                        className={`w-full h-full object-contain ${isLive ? '' : 'hidden'}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Start Camera Overlay — shown when not live */}
                    {!isLive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20">
                            <Camera className="h-16 w-16 text-white/40 mb-4" />
                            <h3 className="text-white text-xl font-semibold mb-2">Camera or Video Ready</h3>
                            <p className="text-gray-400 text-sm mb-6 max-w-sm text-center px-4">
                                Start your camera or upload an MP4 file to run AI-powered queue detection
                            </p>
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={startWebcam}
                                    size="lg"
                                    className="gap-2 text-base px-6 py-6"
                                    disabled={isStarting}
                                >
                                    {isStarting ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Requesting Camera Access...
                                        </>
                                    ) : (
                                        <>
                                            <Video className="h-5 w-5" />
                                            Start Camera
                                        </>
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="lg"
                                    className="gap-2 text-base px-6 py-6"
                                    onClick={() => uploadInputRef.current?.click()}
                                >
                                    <Upload className="h-5 w-5" />
                                    Upload MP4
                                </Button>
                            </div>
                            {error && (
                                <div className="mt-4 bg-red-900/80 border border-red-700 text-red-200 px-4 py-2 rounded-md text-sm max-w-md text-center">
                                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {isLive && sourceType === "upload" && uploadedVideoName && (
                        <div className="absolute top-3 left-3 z-20 bg-black/70 text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm">
                            {uploadedVideoName}
                        </div>
                    )}

                    {/* Real-time AI Detection Overlay */}
                    {isLive && detectionData && detectionData.success && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            <svg className="w-full h-full">
                                {detectionData.detections.map((detection, idx) => {
                                    const [x1, y1, x2, y2] = detection.bbox
                                    const video = videoRef.current
                                    if (!video) return null

                                    const scaleX = video.clientWidth / detectionData.frame_size[0]
                                    const scaleY = video.clientHeight / detectionData.frame_size[1]

                                    const displayX1 = x1 * scaleX
                                    const displayY1 = y1 * scaleY
                                    const displayWidth = (x2 - x1) * scaleX
                                    const displayHeight = (y2 - y1) * scaleY

                                    const color = detection.confidence > 0.7 ? '#22c55e' : '#eab308'

                                    return (
                                        <g key={idx}>
                                            <rect
                                                x={displayX1}
                                                y={displayY1}
                                                width={displayWidth}
                                                height={displayHeight}
                                                fill="none"
                                                stroke={color}
                                                strokeWidth="2"
                                                rx="4"
                                            />
                                            <rect
                                                x={displayX1}
                                                y={displayY1 - 20}
                                                width={Math.max(80, displayWidth * 0.5)}
                                                height="20"
                                                fill={color}
                                                rx="2"
                                            />
                                            <text
                                                x={displayX1 + 4}
                                                y={displayY1 - 6}
                                                fill="#000"
                                                fontSize="11"
                                                fontWeight="bold"
                                                fontFamily="system-ui"
                                            >
                                                {detection.class} {Math.round(detection.confidence * 100)}%
                                            </text>
                                        </g>
                                    )
                                })}
                            </svg>
                            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                                <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm">
                                    People Detected: {detectionData.total_people}
                                </div>
                                {Object.entries(detectionData.counters).map(([counterId, info]) => {
                                    const statusColors: Record<string, string> = {
                                        normal: 'bg-green-500/80',
                                        busy: 'bg-yellow-500/80',
                                        critical: 'bg-red-500/80'
                                    }
                                    return (
                                        <div
                                            key={counterId}
                                            className={`${statusColors[info.status] || 'bg-gray-500/80'} text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm font-semibold`}
                                        >
                                            Counter {counterId}: {info.count}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
