import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { getQueueHistory } from "@/api/queueApi"

export function QueueGraph() {
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch last 20 records for visualization
                const response = await getQueueHistory({ limit: 20 })
                if (response.success && Array.isArray(response.data)) {
                    // Process data: Group by timestamp, sum queue sizes or show total
                    // This is a simple implementation mapping raw history
                    const processedData = response.data.map((item: any) => ({
                        time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        queue: item.queueSize
                    })).reverse() // Show chronological
                    setData(processedData)
                }
            } catch (error) {
                console.error("Failed to fetch queue history", error)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 5000) // Update every 5s
        return () => clearInterval(interval)
    }, [])

    return (
        <Card className="prominent-card motion-rise col-span-4">
            <CardHeader>
                <CardTitle className="text-xl">Queue Overview (Live History)</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                            <XAxis
                                dataKey="time"
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="var(--muted-foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px" }}
                                labelStyle={{ color: "var(--muted-foreground)" }}
                                itemStyle={{ color: "var(--foreground)", fontWeight: 700 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="queue"
                                stroke="var(--primary)"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 5, fill: "var(--primary)" }}
                                isAnimationActive={false} // smoother live updates
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}

