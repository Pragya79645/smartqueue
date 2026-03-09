"use client"

import { useEffect, useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Activity, BarChart3, Users, Bell, Camera, MessageSquare, Sliders, Save, SettingsIcon, Play, X } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
  // State for form fields
  const [cameraUrl, setCameraUrl] = useState("")
  const [additionalUrls, setAdditionalUrls] = useState("")
  const [whatsappKey, setWhatsappKey] = useState("")
  const [phoneNumbers, setPhoneNumbers] = useState("")

  // State for toggles
  const [enableAnalytics, setEnableAnalytics] = useState(true)
  const [enableAlerts, setEnableAlerts] = useState(true)
  const [autoOptimize, setAutoOptimize] = useState(true)

  // State for settings logic
  const [predictionInterval, setPredictionInterval] = useState(15)
  const [rushThreshold, setRushThreshold] = useState(25)

  // UI State
  const [isSaving, setIsSaving] = useState(false)
  const [testVideoOpen, setTestVideoOpen] = useState(false)

  // Refs for webcam
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Load settings on mount
  useEffect(() => {
    const savedCameraUrl = localStorage.getItem("camera_url") || ""
    const savedAdditionalUrls = localStorage.getItem("additional_camera_urls") || ""
    const savedWhatsappKey = localStorage.getItem("whatsapp_key") || ""
    const savedPhoneNumbers = localStorage.getItem("alert_phone_numbers") || ""

    // Load config states
    const savedEnableAnalytics = localStorage.getItem("enable_analytics") !== "false" // default true
    const savedEnableAlerts = localStorage.getItem("enable_alerts") !== "false" // default true
    const savedAutoOptimize = localStorage.getItem("auto_optimize") !== "false" // default true
    const savedInterval = parseInt(localStorage.getItem("prediction_interval") || "15")
    const savedThreshold = parseInt(localStorage.getItem("rush_threshold") || "25")

    setCameraUrl(savedCameraUrl)
    setAdditionalUrls(savedAdditionalUrls)
    setWhatsappKey(savedWhatsappKey)
    setPhoneNumbers(savedPhoneNumbers)
    setEnableAnalytics(savedEnableAnalytics)
    setEnableAlerts(savedEnableAlerts)
    setAutoOptimize(savedAutoOptimize)
    setPredictionInterval(savedInterval)
    setRushThreshold(savedThreshold)
  }, [])

  // Cleanup webcam stream when modal closes
  useEffect(() => {
    if (!testVideoOpen && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [testVideoOpen])

  // Start webcam if modal is open and URL is 0
  useEffect(() => {
    if (testVideoOpen && (cameraUrl === "0" || cameraUrl.toLowerCase() === "webcam")) {
      startWebcam()
    }
  }, [testVideoOpen, cameraUrl])

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
    } catch (err) {
      console.error("Error accessing webcam:", err)
      alert("Error accessing webcam. Please ensure you have granted camera permissions.")
    }
  }

  const handleSave = () => {
    setIsSaving(true)
    // Save to localStorage
    localStorage.setItem("camera_url", cameraUrl)
    localStorage.setItem("additional_camera_urls", additionalUrls)
    localStorage.setItem("whatsapp_key", whatsappKey)
    localStorage.setItem("alert_phone_numbers", phoneNumbers)

    localStorage.setItem("enable_analytics", enableAnalytics.toString())
    localStorage.setItem("enable_alerts", enableAlerts.toString())
    localStorage.setItem("auto_optimize", autoOptimize.toString())
    localStorage.setItem("prediction_interval", predictionInterval.toString())
    localStorage.setItem("rush_threshold", rushThreshold.toString())

    setTimeout(() => {
      setIsSaving(false)
      alert("Settings saved successfully!")
    }, 800)
  }

  const handleTestCamera = () => {
    if (!cameraUrl) {
      alert("Please enter a Camera URL first")
      return
    }
    setTestVideoOpen(true)
  }

  const isWebcam = cameraUrl === "0" || cameraUrl.toLowerCase() === "webcam"

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Queue Intelligence</h1>
                <p className="text-sm text-muted-foreground">AI-powered queue management</p>
              </div>
            </div>

            <nav className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/staff">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  Staff
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" className="gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Button variant="outline" size="icon">
                <Bell className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 relative">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Settings</h2>
          <p className="text-muted-foreground">Configure your AI queue management system</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Configuration */}
          <Card className="lg:col-span-2 border-border/50 bg-card">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground">Camera Configuration</h3>
                  <p className="text-sm text-muted-foreground">Set up your camera feeds for AI analysis</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="camera-url">Camera Feed URL</Label>
                  <Input
                    id="camera-url"
                    placeholder="rtsp://192.168.1.100:554/stream or http://... or 0 for webcam"
                    className="mt-2"
                    value={cameraUrl}
                    onChange={(e) => setCameraUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter RTC/HTTP stream URL or "0" for local webcam
                  </p>
                </div>

                <div>
                  <Label htmlFor="camera-urls">Additional Camera URLs</Label>
                  <Textarea
                    id="camera-urls"
                    placeholder="One URL per line&#10;rtsp://192.168.1.101:554/stream&#10;rtsp://192.168.1.102:554/stream"
                    className="mt-2 font-mono text-sm"
                    rows={5}
                    value={additionalUrls}
                    onChange={(e) => setAdditionalUrls(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Enable Camera Analytics</p>
                    <p className="text-xs text-muted-foreground mt-1">Process video feed with AI for queue detection</p>
                  </div>
                  <Switch
                    checked={enableAnalytics}
                    onCheckedChange={setEnableAnalytics}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50 bg-card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button
                  className="w-full justify-center gap-2"
                  size="lg"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Settings"}
                </Button>
                <Button
                  className="w-full justify-start gap-2 bg-transparent"
                  variant="outline"
                  onClick={handleTestCamera}
                >
                  <Play className="h-4 w-4" />
                  Test Camera Connection
                </Button>
                <Button className="w-full justify-start gap-2 bg-transparent" variant="outline">
                  <MessageSquare className="h-4 w-4" />
                  Test WhatsApp Alert
                </Button>
                <Button className="w-full justify-start gap-2 bg-transparent" variant="outline">
                  <Sliders className="h-4 w-4" />
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </Card>

          {/* WhatsApp Configuration */}
          <Card className="lg:col-span-2 border-border/50 bg-card">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground">WhatsApp Integration</h3>
                  <p className="text-sm text-muted-foreground">Configure automated alerts and notifications</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="whatsapp-key">WhatsApp API Key</Label>
                  <Input
                    id="whatsapp-key"
                    type="password"
                    placeholder="Enter your WhatsApp Business API key"
                    className="mt-2"
                    value={whatsappKey}
                    onChange={(e) => setWhatsappKey(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="phone-numbers">Alert Recipients</Label>
                  <Textarea
                    id="phone-numbers"
                    placeholder="One phone number per line&#10;+1234567890&#10;+0987654321"
                    className="mt-2 font-mono text-sm"
                    rows={4}
                    value={phoneNumbers}
                    onChange={(e) => setPhoneNumbers(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Recipients will receive alerts for high queue loads
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Enable Automatic Alerts</p>
                    <p className="text-xs text-muted-foreground mt-1">Send WhatsApp messages when rush is detected</p>
                  </div>
                  <Switch
                    checked={enableAlerts}
                    onCheckedChange={setEnableAlerts}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Optimization Settings */}
          <Card className="border-border/50 bg-card">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Sliders className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground">Optimization</h3>
                  <p className="text-sm text-muted-foreground">AI model settings</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="prediction-interval">Prediction Interval (mins)</Label>
                  <Input
                    id="prediction-interval"
                    type="number"
                    value={predictionInterval}
                    onChange={(e) => setPredictionInterval(parseInt(e.target.value) || 15)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="threshold">Rush Alert Threshold</Label>
                  <Input
                    id="threshold"
                    type="number"
                    value={rushThreshold}
                    onChange={(e) => setRushThreshold(parseInt(e.target.value) || 25)}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Queue count to trigger alerts</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Auto-optimize Staff</p>
                    <p className="text-xs text-muted-foreground mt-1">Let AI suggest reallocations</p>
                  </div>
                  <Switch
                    checked={autoOptimize}
                    onCheckedChange={setAutoOptimize}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <Button size="lg" className="gap-2" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* Test Video Modal */}
        {testVideoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <Card className="w-full max-w-4xl bg-card border-border relative overflow-hidden">
              <div className="absolute top-4 right-4 z-10">
                <Button variant="secondary" size="icon" onClick={() => setTestVideoOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="aspect-video w-full bg-black flex items-center justify-center">
                {cameraUrl.startsWith('http') ? (
                  <img
                    src={cameraUrl}
                    alt="Camera Feed"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      alert("Error loading video stream. Make sure the URL is accessible.");
                      setTestVideoOpen(false);
                    }}
                  />
                ) : isWebcam ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8">
                    <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-white mb-2">RTSP Stream</p>
                    <p className="text-muted-foreground mb-4">
                      RTSP streams cannot be played directly in the browser without transcoding.
                      <br />
                      The AI Engine will process this stream in the backend.
                    </p>
                    <p className="font-mono bg-zinc-900 px-4 py-2 rounded text-zinc-300 text-sm inline-block">
                      {cameraUrl}
                    </p>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-border">
                <h3 className="font-semibold text-lg">Camera Feed Test</h3>
                <p className="text-sm text-muted-foreground">
                  Testing connection to: {cameraUrl}
                  {isWebcam && " (Local Webcam)"}
                </p>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
