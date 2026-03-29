"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Camera, AlertTriangle, Video, Loader2, Upload } from "lucide-react"
import { processVideoFrame, FrameDetectionResponse } from "@/api/aiApi"

type CounterRect = {
    id: number
    label: string
    x: number
    y: number
    width: number
    height: number
}

type DraftRect = {
    id: number
    startX: number
    startY: number
    currentX: number
    currentY: number
}

const COUNTERS_LS_KEY = "cameraCounters"
const COUNTER_COLORS = ["#3b82f6", "#22c55e", "#f97316"]
const DETECTION_INTERVAL_MS = 250
const CAPTURE_MAX_WIDTH = 960
const JPEG_QUALITY = 0.6

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const colorForCounter = (id: number) => COUNTER_COLORS[(id - 1) % COUNTER_COLORS.length]

export function CameraFeed() {
    const [editMode, setEditMode] = useState(false)
    const [counters, setCounters] = useState<CounterRect[]>([])
    const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null)
    const [draftRect, setDraftRect] = useState<DraftRect | null>(null)

    const [isLive, setIsLive] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [sourceType, setSourceType] = useState<"camera" | "upload">("camera")
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("default")
    const [uploadedVideoName, setUploadedVideoName] = useState<string>("")
    const [detectionData, setDetectionData] = useState<FrameDetectionResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const uploadInputRef = useRef<HTMLInputElement>(null)
    const uploadedVideoUrlRef = useRef<string | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const processingIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const frameRequestInFlightRef = useRef(false)
    const captureDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
    const processingLoopActiveRef = useRef(false)
    const [lastProcessingMs, setLastProcessingMs] = useState<number | null>(null)

    useEffect(() => {
        try {
            const raw = localStorage.getItem(COUNTERS_LS_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) {
                    setCounters(parsed)
                }
            }
        } catch {
            // ignore malformed data
        }
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem(COUNTERS_LS_KEY, JSON.stringify(counters))
        } catch {
            // ignore storage issues
        }
    }, [counters])

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
        if (typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === "function") {
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
            if (typeof navigator !== "undefined" && navigator.mediaDevices && typeof navigator.mediaDevices.removeEventListener === "function") {
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
                stream.getTracks().forEach(track => track.stop())
                setError("Video element not ready. Please try again.")
            }
        } catch (err: any) {
            console.error("Error accessing webcam:", err)
            setIsLive(false)
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setError("Camera permission denied. Please allow camera access in your browser settings and try again.")
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                setError("No camera found. Please connect a camera and try again.")
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                setError("Camera is already in use by another application.")
            } else {
                setError(`Failed to access camera: ${err.message || "Unknown error"}`)
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
                // Browser may block autoplay depending on policy.
            }
        }

        event.target.value = ""
    }

    const captureFrame = async (): Promise<string | null> => {
        if (!videoRef.current || !canvasRef.current) return null
        const video = videoRef.current
        const canvas = canvasRef.current

        if (!video.videoWidth || !video.videoHeight) {
            return null
        }

        const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth)
        const targetWidth = Math.max(1, Math.round(video.videoWidth * scale))
        const targetHeight = Math.max(1, Math.round(video.videoHeight * scale))

        if (
            captureDimensionsRef.current.width !== targetWidth ||
            captureDimensionsRef.current.height !== targetHeight
        ) {
            canvas.width = targetWidth
            canvas.height = targetHeight
            captureDimensionsRef.current = { width: targetWidth, height: targetHeight }
        }

        const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: false })
        if (!ctx) return null
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight)

        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((value) => resolve(value), "image/jpeg", JPEG_QUALITY)
        })

        if (!blob) return null

        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(String(reader.result || ""))
            reader.onerror = () => reject(new Error("Failed to encode frame"))
            reader.readAsDataURL(blob)
        })
    }

    const buildCounterZones = (): Record<string, [number, number, number, number]> | undefined => {
        const video = videoRef.current
        if (!video || !video.videoWidth || !video.videoHeight || counters.length === 0) {
            return undefined
        }

        const zones: Record<string, [number, number, number, number]> = {}
        counters.forEach(counter => {
            const x1 = Math.round(counter.x * video.videoWidth)
            const y1 = Math.round(counter.y * video.videoHeight)
            const x2 = Math.round((counter.x + counter.width) * video.videoWidth)
            const y2 = Math.round((counter.y + counter.height) * video.videoHeight)
            zones[String(counter.id)] = [x1, y1, x2, y2]
        })

        return zones
    }

    const startFrameProcessing = () => {
        if (processingLoopActiveRef.current) return
        if (processingIntervalRef.current) {
            clearInterval(processingIntervalRef.current)
            processingIntervalRef.current = null
        }

        processingLoopActiveRef.current = true
        setIsProcessing(true)
        const loop = async () => {
            if (!processingLoopActiveRef.current) return
            if (frameRequestInFlightRef.current) {
                processingTimeoutRef.current = setTimeout(loop, DETECTION_INTERVAL_MS)
                return
            }

            frameRequestInFlightRef.current = true
            const startedAt = performance.now()

            try {
                const frameData = await captureFrame()
                if (!frameData) {
                    return
                }

                const result = await processVideoFrame(
                    frameData,
                    selectedDeviceId || "webcam",
                    buildCounterZones(),
                    { includeAnnotated: false }
                )
                setDetectionData(result)
                setError(null)
            } catch (err) {
                console.error("Frame processing error:", err)
            } finally {
                const elapsed = Math.round(performance.now() - startedAt)
                setLastProcessingMs(elapsed)
                frameRequestInFlightRef.current = false

                if (processingLoopActiveRef.current) {
                    const delay = Math.max(0, DETECTION_INTERVAL_MS - elapsed)
                    processingTimeoutRef.current = setTimeout(loop, delay)
                }
            }
        }

        void loop()
    }

    useEffect(() => {
        if (!isLive || sourceType !== "camera") return
        void startWebcam()
    }, [selectedDeviceId, sourceType])

    const stopProcessing = () => {
        processingLoopActiveRef.current = false
        if (processingIntervalRef.current) {
            clearInterval(processingIntervalRef.current)
            processingIntervalRef.current = null
        }
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current)
            processingTimeoutRef.current = null
        }
        frameRequestInFlightRef.current = false
        setIsProcessing(false)
        setDetectionData(null)
        setLastProcessingMs(null)
    }

    const getRelativePoint = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        return {
            x: clamp01((e.clientX - rect.left) / rect.width),
            y: clamp01((e.clientY - rect.top) / rect.height)
        }
    }

    const handleDrawStart = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!editMode || counters.length >= 3) return
        const point = getRelativePoint(e)
        const id = counters.length + 1
        setDraftRect({
            id,
            startX: point.x,
            startY: point.y,
            currentX: point.x,
            currentY: point.y
        })
        setSelectedCounterId(id)
    }

    const handleDrawMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!editMode || !draftRect) return
        const point = getRelativePoint(e)
        setDraftRect(prev => {
            if (!prev) return prev
            return { ...prev, currentX: point.x, currentY: point.y }
        })
    }

    const handleDrawEnd = () => {
        if (!editMode || !draftRect) return

        const x = Math.min(draftRect.startX, draftRect.currentX)
        const y = Math.min(draftRect.startY, draftRect.currentY)
        const width = Math.abs(draftRect.currentX - draftRect.startX)
        const height = Math.abs(draftRect.currentY - draftRect.startY)

        if (width > 0.02 && height > 0.02) {
            setCounters(prev => [
                ...prev,
                {
                    id: draftRect.id,
                    label: `Counter ${draftRect.id}`,
                    x,
                    y,
                    width,
                    height
                }
            ])
        }

        setDraftRect(null)
    }

    const draftAsRect = draftRect
        ? {
            x: Math.min(draftRect.startX, draftRect.currentX),
            y: Math.min(draftRect.startY, draftRect.currentY),
            width: Math.abs(draftRect.currentX - draftRect.startX),
            height: Math.abs(draftRect.currentY - draftRect.startY),
            id: draftRect.id
        }
        : null

    return (
        <Card className="prominent-card motion-rise overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold">Live Camera Feed</CardTitle>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs">
                        <input
                            type="checkbox"
                            checked={editMode}
                            onChange={() => {
                                setEditMode(v => !v)
                                setSelectedCounterId(null)
                                setDraftRect(null)
                            }}
                        />
                        <span className="ml-1">Draw Counters</span>
                    </label>

                    {editMode && (
                        <>
                            <span className="text-xs text-muted-foreground">{counters.length}/3</span>
                            <Button size="sm" variant="outline" onClick={() => setCounters([])}>Clear</Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCounters(prev => prev.slice(0, -1))}
                                disabled={counters.length === 0}
                            >
                                Undo
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setCounters(prev => prev.filter(c => c.id !== selectedCounterId))}
                                disabled={selectedCounterId == null}
                            >
                                Delete Selected
                            </Button>
                        </>
                    )}

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
                        className="h-8 gap-1 font-medium"
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
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        controls={sourceType === "upload"}
                        muted={sourceType === "camera"}
                        className={`w-full h-full object-contain ${isLive ? "" : "hidden"}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {!isLive && !editMode && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20">
                            <Camera className="h-16 w-16 text-white/40 mb-4" />
                            <h3 className="text-white text-xl font-semibold mb-2">Camera or Video Ready</h3>
                            <p className="text-gray-400 text-sm mb-6 max-w-sm text-center px-4">
                                Start camera/upload video, then enable Draw Counters and drag to define Counter 1-3.
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

                    {/* Manual counter rectangle editor + labels */}
                    {(isLive || editMode) && (
                        <div
                            className={`absolute inset-0 z-20 ${editMode ? "cursor-crosshair" : "pointer-events-none"}`}
                            onMouseDown={handleDrawStart}
                            onMouseMove={handleDrawMove}
                            onMouseUp={handleDrawEnd}
                            onMouseLeave={handleDrawEnd}
                        >
                            <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="w-full h-full">
                                {counters.map(counter => {
                                    const selected = selectedCounterId === counter.id
                                    const color = colorForCounter(counter.id)
                                    return (
                                        <g key={counter.id} onMouseDown={(e) => { e.stopPropagation(); setSelectedCounterId(counter.id) }}>
                                            <rect
                                                x={counter.x}
                                                y={counter.y}
                                                width={counter.width}
                                                height={counter.height}
                                                fill={selected ? `${color}44` : `${color}22`}
                                                stroke={color}
                                                strokeWidth={0.004}
                                            />
                                            <text
                                                x={counter.x + 0.01}
                                                y={Math.max(0.03, counter.y - 0.01)}
                                                fill={color}
                                                fontSize="0.03"
                                                fontWeight="700"
                                            >
                                                {counter.label}
                                            </text>
                                        </g>
                                    )
                                })}

                                {draftAsRect && (
                                    <rect
                                        x={draftAsRect.x}
                                        y={draftAsRect.y}
                                        width={draftAsRect.width}
                                        height={draftAsRect.height}
                                        fill={`${colorForCounter(draftAsRect.id)}22`}
                                        stroke={colorForCounter(draftAsRect.id)}
                                        strokeWidth={0.004}
                                        strokeDasharray="0.01"
                                    />
                                )}
                            </svg>

                            {editMode && (
                                <div className="absolute left-3 bottom-3 z-30 text-xs text-white bg-black/70 px-3 py-2 rounded-md backdrop-blur-sm">
                                    Drag mouse to draw rectangular counters (max 3). Click a rectangle to select it.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Real-time AI detection overlay */}
                    {isLive && detectionData && detectionData.success && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            {detectionData.annotated_frame ? (
                                <img
                                    src={`data:image/jpeg;base64,${detectionData.annotated_frame}`}
                                    alt="AI annotated detection"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
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
                                        const counterId = Number(detection.counter)
                                        const color = Number.isFinite(counterId)
                                            ? colorForCounter(counterId)
                                            : (detection.confidence > 0.7 ? "#22c55e" : "#eab308")

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
                                                    width={Math.max(96, displayWidth * 0.6)}
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
                                                    person {Math.round(detection.confidence * 100)}% {detection.counter ? `C${detection.counter}` : ""}
                                                </text>
                                            </g>
                                        )
                                    })}
                                </svg>
                            )}

                            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                                <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm">
                                    People Detected: {detectionData.total_people}
                                </div>
                                <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm">
                                    Proc: {lastProcessingMs ?? 0}ms
                                </div>

                                {counters.length > 0 ? (
                                    counters.map(counter => {
                                        const info = detectionData.counters?.[String(counter.id)]
                                        const count = info?.count ?? 0
                                        return (
                                            <div
                                                key={counter.id}
                                                className="text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm font-semibold"
                                                style={{ backgroundColor: `${colorForCounter(counter.id)}cc` }}
                                            >
                                                {counter.label}: {count}
                                            </div>
                                        )
                                    })
                                ) : (
                                    Object.entries(detectionData.counters).map(([counterId, info]) => {
                                        const idNum = Number(counterId)
                                        return (
                                            <div
                                                key={counterId}
                                                className="text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm font-semibold"
                                                style={{ backgroundColor: `${colorForCounter(Number.isFinite(idNum) ? idNum : 1)}cc` }}
                                            >
                                                Counter {counterId}: {info.count}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
