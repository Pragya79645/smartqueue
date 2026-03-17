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
        <Card className="prominent-card motion-rise border-primary/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <CardTitle className="text-xl">AI Prediction</CardTitle>
                    </div>
                    <Badge variant="outline" className="bg-primary/15 text-primary border-primary/40 px-3 py-1 font-semibold">
                        {confidence}% confident
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{timeframe}</p>
                    <div className="flex items-center gap-3">
                        <p className="text-3xl font-extrabold text-card-foreground">{expectedQueue} customers</p>
                        <Badge variant="outline" className={`${rushColors[rushLevel]} px-3 py-1 font-semibold uppercase`}>
                            {rushLevel} rush
                        </Badge>
                    </div>
                </div>

                <div className="flex gap-2 p-3 bg-muted/65 rounded-xl border border-border/60">
                    <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/85">{recommendation}</p>
                </div>
            </CardContent>
        </Card>
    )
}
