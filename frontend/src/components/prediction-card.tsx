import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, TrendingUp } from "lucide-react"

interface PredictionCardProps {
    timeframe: string
    expectedQueue: number
    rushLevel: "low" | "medium" | "high"
    recommendation: string
    confidence: number
}

export function PredictionCard({
    timeframe,
    expectedQueue,
    rushLevel,
    recommendation,
    confidence,
}: PredictionCardProps) {
    const rushColors: Record<PredictionCardProps['rushLevel'], string> = {
        low: "bg-success/10 text-success border-success/20",
        medium: "bg-warning/10 text-warning border-warning/20",
        high: "bg-destructive/10 text-destructive border-destructive/20",
    }

    return (
        <Card className="border-primary/20">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <CardTitle>AI Prediction</CardTitle>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        {confidence}% confident
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground mb-1">{timeframe}</p>
                    <div className="flex items-center gap-3">
                        <p className="text-2xl font-bold text-card-foreground">{expectedQueue} customers</p>
                        <Badge variant="outline" className={rushColors[rushLevel]}>
                            {rushLevel} rush
                        </Badge>
                    </div>
                </div>

                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                    <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{recommendation}</p>
                </div>
            </CardContent>
        </Card>
    )
}
