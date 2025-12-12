"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Activity, BarChart3, Users, Bell, Camera, MessageSquare, Sliders, Save, SettingsIcon } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
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

      <main className="container mx-auto px-6 py-8">
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
                  <Input id="camera-url" placeholder="rtsp://192.168.1.100:554/stream" className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter the RTSP or HTTP stream URL for your camera
                  </p>
                </div>

                <div>
                  <Label htmlFor="camera-urls">Additional Camera URLs</Label>
                  <Textarea
                    id="camera-urls"
                    placeholder="One URL per line&#10;rtsp://192.168.1.101:554/stream&#10;rtsp://192.168.1.102:554/stream"
                    className="mt-2 font-mono text-sm"
                    rows={5}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Enable Camera Analytics</p>
                    <p className="text-xs text-muted-foreground mt-1">Process video feed with AI for queue detection</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/50 bg-card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button className="w-full justify-start gap-2 bg-transparent" variant="outline">
                  <Camera className="h-4 w-4" />
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
                  />
                </div>

                <div>
                  <Label htmlFor="phone-numbers">Alert Recipients</Label>
                  <Textarea
                    id="phone-numbers"
                    placeholder="One phone number per line&#10;+1234567890&#10;+0987654321"
                    className="mt-2 font-mono text-sm"
                    rows={4}
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
                  <Switch defaultChecked />
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
                  <Input id="prediction-interval" type="number" defaultValue={15} className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="threshold">Rush Alert Threshold</Label>
                  <Input id="threshold" type="number" defaultValue={25} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-2">Queue count to trigger alerts</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">Auto-optimize Staff</p>
                    <p className="text-xs text-muted-foreground mt-1">Let AI suggest reallocations</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <Button size="lg" className="gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </main>
    </div>
  )
}
