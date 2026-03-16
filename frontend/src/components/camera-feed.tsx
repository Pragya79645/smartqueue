"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Camera, AlertTriangle, Video, Loader2, Upload } from "lucide-react"
import { processVideoFrame, FrameDetectionResponse } from "@/api/aiApi"

export function CameraFeed() {
    const [editMode, setEditMode] = useState(false)
    const [counters, setCounters] = useState<Array<{ id: number; x: number; y: number; label?: string; area?: Array<{ x: number; y: number }> }>>([])
    const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null)
    const [drawingForId, setDrawingForId] = useState<number | null>(null)
    const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)

    const COUNTERS_LS_KEY = 'cameraCounters'

    useEffect(() => {
        try {
            const raw = localStorage.getItem(COUNTERS_LS_KEY)
            if (raw) setCounters(JSON.parse(raw))
        } catch (e) {
            // ignore
        }
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem(COUNTERS_LS_KEY, JSON.stringify(counters))
        } catch (e) {
            // ignore
        }
    }, [counters])
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

    const pointInPolygon = (pt: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) => {
        let inside = false
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y
            const xj = polygon[j].x, yj = polygon[j].y
            const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 0.0000001) + xi)
            if (intersect) inside = !inside
        }
        return inside
    }

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!editMode) return
        const el = e.currentTarget.getBoundingClientRect()
        const cx = (e.clientX - el.left) / el.width
        const cy = (e.clientY - el.top) / el.height

        // If we're drawing an area for a counter, add a point
        if (drawingForId != null) {
            setCounters(prev => prev.map(c => {
                if (c.id !== drawingForId) return c
                const area = c.area ? [...c.area, { x: cx, y: cy }] : [{ x: cx, y: cy }]
                return { ...c, area }
            }))
            return
        }

        // Not drawing: move nearest counter or create one
        if (counters.length === 0) {
            setCounters([{ id: 1, x: cx, y: cy }])
            setSelectedCounterId(1)
            return
        }

        let nearestIdx = 0
        let nearestDist = Infinity
        counters.forEach((c, i) => {
            const dx = c.x - cx
            const dy = c.y - cy
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < nearestDist) {
                nearestDist = d
                nearestIdx = i
            }
        })

        setCounters(prev => {
            const next = prev.map((c, i) => ({ ...c }))
            next[nearestIdx].x = cx
            next[nearestIdx].y = cy
            return next
        })
        setSelectedCounterId(counters[nearestIdx].id)
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Live Camera Feed</CardTitle>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" checked={editMode} onChange={() => { setEditMode(v => !v); setSelectedCounterId(null) }} />
                            <span className="ml-1">Edit Counters</span>
                        </label>
                        {editMode && (
                            <div className="flex items-center gap-2">
                                <label className="text-xs">Counters:</label>
                                <input
                                    aria-label="Number of counters"
                                    type="number"
                                    min={0}
                                    value={counters.length}
                                    onChange={(e) => {
                                        const n = Math.max(0, Math.floor(Number(e.target.value) || 0))
                                        setCounters(prev => {
                                            if (n === prev.length) return prev
                                            if (n > prev.length) {
                                                const next = [...prev]
                                                for (let i = prev.length; i < n; i++) {
                                                    next.push({ id: i + 1, x: 0.12 + 0.12 * i, y: 0.75 })
                                                }
                                                return next
                                            }
                                            return prev.slice(0, n)
                                        })
                                    }}
                                    className="w-16 h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                />
                                <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem(COUNTERS_LS_KEY); setCounters([]) }}>Clear</Button>
                            </div>
                        )}
                    </div>

                    {/* Templates & quick tools */}
                    {editMode && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs">Templates</label>
                            <select
                                value={''}
                                onChange={(e) => {
                                    const val = e.target.value
                                    if (val === '2-lr') {
                                        setCounters([{ id: 1, x: 0.15, y: 0.75, label: 'Left' }, { id: 2, x: 0.85, y: 0.75, label: 'Right' }])
                                    } else if (val === '3-row') {
                                        setCounters([{ id: 1, x: 0.15, y: 0.75, label: '1' }, { id: 2, x: 0.5, y: 0.75, label: '2' }, { id: 3, x: 0.85, y: 0.75, label: '3' }])
                                    } else if (val === 'entry-exit') {
                                        setCounters([{ id: 1, x: 0.2, y: 0.9, label: 'Entry' }, { id: 2, x: 0.8, y: 0.9, label: 'Exit' }])
                                    }
                                    // reset select
                                    e.currentTarget.value = ''
                                }}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            >
                                <option value="">Choose…</option>
                                <option value="2-lr">2 Counters (Left/Right)</option>
                                <option value="3-row">3 Counters (Across)</option>
                                <option value="entry-exit">Entry / Exit</option>
                            </select>
                            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(counters)); }}>Export</Button>
                            <Button size="sm" variant="outline" onClick={async () => {
                                try {
                                    const txt = await navigator.clipboard?.readText()
                                    if (txt) setCounters(JSON.parse(txt))
                                } catch { }
                            }}>Import</Button>
                        </div>
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

                    {/* Start Camera Overlay — shown when not live (hidden if editing) */}
                    {!isLive && !editMode && (
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

                    {/* Counter markers / edit overlay */}
                    {(isLive || editMode) && (editMode || counters.length > 0) && (
                        <div
                            className="absolute inset-0 z-20"
                            onClick={handleOverlayClick}
                            onMouseMove={(e) => {
                                if (!editMode || drawingForId == null) return
                                const el = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                                const cx = (e.clientX - el.left) / el.width
                                const cy = (e.clientY - el.top) / el.height
                                setHoverPoint({ x: cx, y: cy })
                            }}
                            onMouseLeave={() => { if (drawingForId != null) setHoverPoint(null) }}
                            style={{ cursor: editMode ? 'crosshair' : 'default' }}
                        >
                            <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="w-full h-full pointer-events-auto">
                                {counters.map((c) => (
                                    <g key={c.id} onClick={(ev) => { ev.stopPropagation(); setSelectedCounterId(c.id) }}>
                                        {c.area && c.area.length >= 3 && (
                                            <polygon
                                                points={c.area.map(p => `${p.x},${p.y}`).join(' ')}
                                                fill={selectedCounterId === c.id ? 'rgba(255,123,123,0.18)' : 'rgba(59,130,246,0.12)'}
                                                stroke={selectedCounterId === c.id ? '#ff7b7b' : '#3b82f6'}
                                                strokeWidth={0.002}
                                            />
                                        )}
                                        {/* live polyline preview when drawing for this counter */}
                                        {drawingForId === c.id && (
                                            <>
                                                <polyline
                                                    points={((c.area || []).map(p => `${p.x},${p.y}`).concat(hoverPoint ? `${hoverPoint.x},${hoverPoint.y}` : [])).join(' ')}
                                                    fill="none"
                                                    stroke="#ff7b7b"
                                                    strokeWidth={0.002}
                                                    strokeDasharray="0.004"
                                                />
                                            </>
                                        )}
                                        <circle cx={c.x} cy={c.y} r={0.02} fill={selectedCounterId === c.id ? '#ff7b7b' : '#3b82f6'} stroke="#fff" strokeWidth={0.002} />
                                        <text x={c.x + 0.025} y={c.y + 0.005} fill="#fff" fontSize="0.03" fontWeight="600">{c.label || `#${c.id}`}</text>
                                        {c.area && c.area.map((p, i) => (
                                            <circle key={i} cx={p.x} cy={p.y} r={0.01} fill="#fff" stroke="#000" strokeWidth={0.001} />
                                        ))}
                                    </g>
                                ))}
                            </svg>

                            {/* Legend & quick help */}
                            <div className="absolute left-3 bottom-3 z-30 text-xs text-white">
                                <div className="bg-black/70 px-3 py-2 rounded-md backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-blue-500" />
                                        <div>Counter marker</div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-3 h-3 rounded bg-yellow-500" />
                                        <div>AI-detected (backend)</div>
                                    </div>
                                    {editMode && (
                                        <div className="mt-2 text-xs text-gray-200">
                                            Click a marker to select. Use "Start Area" then click to add vertices. "Undo Point" removes last vertex.
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* If editing when not live, show small instruction */}
                            {!isLive && editMode && (
                                <div className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none">
                                    <div className="bg-black/60 text-white px-3 py-2 rounded-md text-sm">Edit mode active — click to place counters on the frame placeholder</div>
                                </div>
                            )}

                            {selectedCounterId != null && editMode && (
                                <div className="absolute top-3 right-3 z-30 bg-black/80 text-white p-2 rounded-md backdrop-blur-sm text-xs">
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs">Label</label>
                                        <input
                                            value={(counters.find(x => x.id === selectedCounterId)?.label) || ''}
                                            onChange={(e) => setCounters(prev => prev.map(p => p.id === selectedCounterId ? { ...p, label: e.target.value } : p))}
                                            className="text-xs px-2 py-1 rounded bg-black/50 border border-white/20"
                                        />
                                    </div>
                                    <div className="mt-2 flex gap-2 items-center">
                                        <Button size="xs" variant="outline" onClick={() => setSelectedCounterId(null)}>Done</Button>
                                        <Button size="xs" variant="destructive" onClick={() => setCounters(prev => prev.filter(p => p.id !== selectedCounterId))}>Delete</Button>
                                        {drawingForId === selectedCounterId ? (
                                            <>
                                                <Button size="xs" variant="ghost" onClick={() => { setDrawingForId(null); setHoverPoint(null) }}>Finish Area</Button>
                                                <Button size="xs" variant="outline" onClick={() => setCounters(prev => prev.map(p => p.id === selectedCounterId ? { ...p, area: [] } : p))}>Clear Area</Button>
                                                <Button size="xs" variant="outline" onClick={() => setCounters(prev => prev.map(p => p.id === selectedCounterId ? { ...p, area: p.area ? p.area.slice(0, -1) : [] } : p))}>Undo Point</Button>
                                            </>
                                        ) : (
                                            <Button size="xs" variant="secondary" onClick={() => setDrawingForId(selectedCounterId)}>Start Area</Button>
                                        )}
                                    </div>
                                </div>
                            )}
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
                                {/** If user-drawn areas exist, compute counts based on polygon membership */}
                                {counters.length > 0 ? (
                                    counters.map(c => {
                                        let count = 0
                                        if (c.area && c.area.length >= 3) {
                                            // compute counts from detections
                                            detectionData.detections.forEach(d => {
                                                if (!d.class || d.class.toLowerCase() !== 'person') return
                                                const [ax, ay, bx, by] = d.bbox
                                                const cx = (ax + bx) / 2 / detectionData.frame_size[0]
                                                const cy = (ay + by) / 2 / detectionData.frame_size[1]
                                                if (pointInPolygon({ x: cx, y: cy }, c.area!)) count++
                                            })
                                        }
                                        const statusColor = count > 5 ? 'bg-red-500/80' : (count > 2 ? 'bg-yellow-500/80' : 'bg-green-500/80')
                                        return (
                                            <div key={c.id} className={`${statusColor} text-white text-xs px-3 py-1.5 rounded backdrop-blur-sm font-semibold`}>
                                                {c.label || `Counter ${c.id}`}: {count}
                                            </div>
                                        )
                                    })
                                ) : (
                                    Object.entries(detectionData.counters).map(([counterId, info]) => {
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
